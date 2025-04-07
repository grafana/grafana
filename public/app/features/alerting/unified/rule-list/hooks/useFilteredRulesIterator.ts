import { AsyncIterableX, empty, from } from 'ix/asynciterable';
import { merge } from 'ix/asynciterable/merge';
import { catchError, withAbort } from 'ix/asynciterable/operators';
import { isEmpty } from 'lodash';

import {
  DataSourceRuleGroupIdentifier,
  DataSourceRulesSourceIdentifier,
  GrafanaRuleGroupIdentifier,
} from 'app/types/unified-alerting';
import {
  GrafanaPromRuleDTO,
  GrafanaPromRuleGroupDTO,
  PromRuleDTO,
  PromRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { RulesFilter } from '../../search/rulesSearchParser';
import {
  getDataSourceByUid,
  getDatasourceAPIUid,
  getExternalRulesSources,
  isRulesDataSourceType,
} from '../../utils/datasource';

import { groupFilter, ruleFilter } from './filters';
import { useGrafanaGroupsGenerator, usePrometheusGroupsGenerator } from './prometheusGroupsGenerator';

export type RuleWithOrigin = PromRuleWithOrigin | GrafanaRuleWithOrigin;

export interface GrafanaRuleWithOrigin {
  rule: GrafanaPromRuleDTO;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  /**
   * The name of the namespace that contains the rule group
   * groupIdentifier contains the uid of the namespace, but not the user-friendly display name
   */
  namespaceName: string;
  origin: 'grafana';
}

export interface PromRuleWithOrigin {
  rule: PromRuleDTO;
  groupIdentifier: DataSourceRuleGroupIdentifier;
  origin: 'datasource';
}

interface GetIteratorResult {
  iterator: AsyncIterableX<RuleWithOrigin>;
  abortController: AbortController;
}

export function useFilteredRulesIteratorProvider() {
  const allExternalRulesSources = getExternalRulesSources();

  const prometheusGroupsGenerator = usePrometheusGroupsGenerator();
  const grafanaGroupsGenerator = useGrafanaGroupsGenerator();

  const getFilteredRulesIterator = (filterState: RulesFilter, groupLimit: number): GetIteratorResult => {
    /* this is the abort controller that allows us to stop an AsyncIterable */
    const abortController = new AbortController();

    const normalizedFilterState = normalizeFilterState(filterState);
    const hasDataSourceFilterActive = Boolean(filterState.dataSourceNames.length);

    // Create the generator for Grafana rules
    const grafanaRulesGenerator = filterGrafanaRules(
      from(grafanaGroupsGenerator(groupLimit)).pipe(
        withAbort(abortController.signal),
        catchError(() => empty())
      ),
      normalizedFilterState
    );

    // Determine which data sources to use
    const externalRulesSourcesToFetchFrom = hasDataSourceFilterActive
      ? getRulesSourcesFromFilter(filterState)
      : allExternalRulesSources;

    // If no data sources, just return Grafana rules
    if (isEmpty(externalRulesSourcesToFetchFrom)) {
      return {
        iterator: from(grafanaRulesGenerator),
        abortController,
      };
    }

    // Create a generator for each data source
    const dataSourceGenerators = externalRulesSourcesToFetchFrom.map((dataSourceIdentifier) => {
      const promGroupsGenerator = from(prometheusGroupsGenerator(dataSourceIdentifier, groupLimit)).pipe(
        withAbort(abortController.signal),
        catchError(() => empty())
      );

      return filteredDataSourceRulesGenerator(promGroupsGenerator, dataSourceIdentifier, normalizedFilterState);
    });

    // Merge all generators
    return {
      iterator: merge(grafanaRulesGenerator, ...dataSourceGenerators),
      abortController,
    };
  };

  return { getFilteredRulesIterator };
}

/**
 * Flattens groups to rules and filters them
 */
async function* filterGrafanaRules(
  groupsGenerator: AsyncIterable<GrafanaPromRuleGroupDTO[]>,
  filterState: RulesFilter
): AsyncGenerator<RuleWithOrigin, void, unknown> {
  for await (const groups of groupsGenerator) {
    for (const group of groups) {
      if (!groupFilter(group, filterState)) {
        continue;
      }

      for (const rule of group.rules) {
        if (!ruleFilter(rule, filterState)) {
          continue;
        }

        yield mapGrafanaRuleToRuleWithOrigin(group, rule);
      }
    }
  }
}

/**
 * Flattens groups to rules and filters them
 */
async function* filteredDataSourceRulesGenerator(
  groupsGenerator: AsyncIterableX<PromRuleGroupDTO[]>,
  dataSourceIdentifier: DataSourceRulesSourceIdentifier,
  filterState: RulesFilter
): AsyncGenerator<RuleWithOrigin, void, unknown> {
  for await (const groups of groupsGenerator) {
    for (const group of groups) {
      if (!groupFilter(group, filterState)) {
        continue;
      }

      for (const rule of group.rules) {
        if (!ruleFilter(rule, filterState)) {
          continue;
        }

        yield mapRuleToRuleWithOrigin(dataSourceIdentifier, group, rule);
      }
    }
  }
}

/**
 * Finds all data sources that the user might want to filter by.
 * Only allows Prometheus and Loki data source types.
 */
function getRulesSourcesFromFilter(filter: RulesFilter): DataSourceRulesSourceIdentifier[] {
  return filter.dataSourceNames.reduce<DataSourceRulesSourceIdentifier[]>((acc, dataSourceName) => {
    // since "getDatasourceAPIUid" can throw we'll omit any non-existing data sources
    try {
      const uid = getDatasourceAPIUid(dataSourceName);
      const type = getDataSourceByUid(uid)?.type;

      if (type === undefined || isRulesDataSourceType(type) === false) {
        return acc;
      }

      acc.push({
        name: dataSourceName,
        uid,
        ruleSourceType: 'datasource',
      });
    } catch {}

    return acc;
  }, []);
}

function mapRuleToRuleWithOrigin(
  rulesSource: DataSourceRulesSourceIdentifier,
  group: PromRuleGroupDTO,
  rule: PromRuleDTO
): PromRuleWithOrigin {
  return {
    rule,
    groupIdentifier: {
      rulesSource,
      namespace: { name: group.file },
      groupName: group.name,
      groupOrigin: 'datasource',
    },
    origin: 'datasource',
  };
}

function mapGrafanaRuleToRuleWithOrigin(
  group: GrafanaPromRuleGroupDTO,
  rule: GrafanaPromRuleDTO
): GrafanaRuleWithOrigin {
  return {
    rule,
    groupIdentifier: {
      namespace: { uid: group.folderUid },
      groupName: group.name,
      groupOrigin: 'grafana',
    },
    namespaceName: group.file,
    origin: 'grafana',
  };
}

/**
 * Lowercase free form words, rule name, group name and namespace
 */
function normalizeFilterState(filterState: RulesFilter): RulesFilter {
  return {
    ...filterState,
    freeFormWords: filterState.freeFormWords.map((word) => word.toLowerCase()),
    ruleName: filterState.ruleName?.toLowerCase(),
    groupName: filterState.groupName?.toLowerCase(),
    namespace: filterState.namespace?.toLowerCase(),
  };
}
