import { AsyncIterableX, empty, from } from 'ix/asynciterable';
import { merge } from 'ix/asynciterable/merge';
import { catchError, flatMap, map } from 'ix/asynciterable/operators';
import { includes, isEmpty } from 'lodash';

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
import { getDataSourceByUid, getDatasourceAPIUid, getExternalRulesSources } from '../../utils/datasource';

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

export function useFilteredRulesIteratorProvider() {
  const allExternalRulesSources = getExternalRulesSources();

  const prometheusGroupsGenerator = usePrometheusGroupsGenerator();
  const grafanaGroupsGenerator = useGrafanaGroupsGenerator();

  const getFilteredRulesIterator = (filterState: RulesFilter, groupLimit: number): AsyncIterableX<RuleWithOrigin> => {
    const normalizedFilterState = normalizeFilterState(filterState);
    const hasDataSourceFilterActive = Boolean(filterState.dataSourceNames.length);

    // create the iterable sequence for Grafana managed implementation
    const grafanaIterator = from(grafanaGroupsGenerator(groupLimit)).pipe(
      flatMap((groups) =>
        groups
          .filter((group) => groupFilter(group, normalizedFilterState))
          .flatMap((group) => group.rules.map((rule) => [group, rule] as const))
          .filter(([_, rule]) => ruleFilter(rule, normalizedFilterState))
          .map(([group, rule]) => mapGrafanaRuleToRuleWithOrigin(group, rule))
      ),
      catchError(() => empty())
    );

    // check filters for potential data source filter to we don't pull from all data sources
    const externalRulesSourcesToFetchFrom = hasDataSourceFilterActive
      ? getRulesSourcesFromFilter(filterState)
      : allExternalRulesSources;

    // create the iterable sequence for upstream Prometheus / Mimir managed implementation
    const prometheusRulesSourceIterables = externalRulesSourcesToFetchFrom.map((dataSourceIdentifier) => {
      const generator = prometheusGroupsGenerator(dataSourceIdentifier, groupLimit);
      return from(generator).pipe(
        map((group) => [dataSourceIdentifier, group] as const),
        catchError(() => empty())
      );
    });

    // if we have no prometheus data sources, use an empty async iterable
    const source = isEmpty(prometheusRulesSourceIterables) ? empty() : prometheusRulesSourceIterables[0];
    const otherIterables = prometheusRulesSourceIterables.slice(1);

    const dataSourcesIterator = merge(source, ...otherIterables).pipe(
      flatMap(([rulesSource, groups]) =>
        groups
          .filter((group) => groupFilter(group, normalizedFilterState))
          .flatMap((group) => group.rules.map((rule) => [rulesSource, group, rule] as const))
          .filter(([_, __, rule]) => ruleFilter(rule, normalizedFilterState))
          .map(([rulesSource, group, rule]) => mapRuleToRuleWithOrigin(rulesSource, group, rule))
      )
    );

    return merge(grafanaIterator, dataSourcesIterator);
  };

  return { getFilteredRulesIterator };
}

// find all data sources that the user might want to filter by, only allow Prometheus and Loki data source types
const SUPPORTED_RULES_SOURCE_TYPES = ['loki', 'prometheus'];
function getRulesSourcesFromFilter(filter: RulesFilter): DataSourceRulesSourceIdentifier[] {
  return filter.dataSourceNames.reduce<DataSourceRulesSourceIdentifier[]>((acc, dataSourceName) => {
    // since "getDatasourceAPIUid" can throw we'll omit any non-existing data sources
    try {
      const uid = getDatasourceAPIUid(dataSourceName);
      const type = getDataSourceByUid(uid)?.type;

      if (!includes(SUPPORTED_RULES_SOURCE_TYPES, type)) {
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
