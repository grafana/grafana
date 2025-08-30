import { AsyncIterableX, from } from 'ix/asynciterable';
import { merge } from 'ix/asynciterable/merge';
import { catchError, concatMap, withAbort } from 'ix/asynciterable/operators';
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
  isSupportedExternalRulesSourceType,
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
  iterable: AsyncIterableX<RuleWithOrigin>;
  abortController: AbortController;
}

export function useFilteredRulesIteratorProvider() {
  const allExternalRulesSources = getExternalRulesSources();

  const prometheusGroupsGenerator = usePrometheusGroupsGenerator();
  const grafanaGroupsGenerator = useGrafanaGroupsGenerator({ limitAlerts: 0 });

  const getFilteredRulesIterable = (filterState: RulesFilter, groupLimit: number): GetIteratorResult => {
    /* this is the abort controller that allows us to stop an AsyncIterable */
    const abortController = new AbortController();

    const normalizedFilterState = normalizeFilterState(filterState);
    const hasDataSourceFilterActive = Boolean(filterState.dataSourceNames.length);

    const grafanaRulesGenerator: AsyncIterableX<RuleWithOrigin> = from(
      grafanaGroupsGenerator(groupLimit, {
        contactPoint: filterState.contactPoint ?? undefined,
        health: filterState.ruleHealth ? [filterState.ruleHealth] : [],
        state: filterState.ruleState ? [filterState.ruleState] : [],
      })
    ).pipe(
      withAbort(abortController.signal),
      concatMap((groups) =>
        groups
          .filter((group) => groupFilter(group, normalizedFilterState))
          .flatMap((group) => group.rules.map((rule) => ({ group, rule })))
          .filter(({ rule }) => ruleFilter(rule, normalizedFilterState))
          .map(({ group, rule }) => mapGrafanaRuleToRuleWithOrigin(group, rule))
      ),
      catchError(() => emptyRulesIterable())
    );

    // Determine which data sources to use
    const externalRulesSourcesToFetchFrom = hasDataSourceFilterActive
      ? getRulesSourcesFromFilter(filterState)
      : allExternalRulesSources;

    if (filterState.ruleSource === 'grafana') {
      return { iterable: grafanaRulesGenerator, abortController };
    }

    if (filterState.ruleSource === 'external') {
      if (isEmpty(externalRulesSourcesToFetchFrom)) {
        return { iterable: emptyRulesIterable(), abortController };
      }
    }

    const dataSourceGenerators: Array<AsyncIterableX<RuleWithOrigin>> = externalRulesSourcesToFetchFrom.map(
      (dataSourceIdentifier) => {
        const promGroupsGenerator: AsyncIterableX<RuleWithOrigin> = from(
          prometheusGroupsGenerator(dataSourceIdentifier, groupLimit)
        ).pipe(
          withAbort(abortController.signal),
          concatMap((groups) =>
            groups
              .filter((group) => groupFilter(group, normalizedFilterState))
              .flatMap((group) => group.rules.map((rule) => ({ group, rule })))
              .filter(({ rule }) => ruleFilter(rule, normalizedFilterState))
              .map(({ group, rule }) => mapRuleToRuleWithOrigin(dataSourceIdentifier, group, rule))
          ),
          catchError(() => emptyRulesIterable())
        );

        return promGroupsGenerator;
      }
    );

    const iterablesToMerge: Array<AsyncIterableX<RuleWithOrigin>> = [];
    const includeGrafana = filterState.ruleSource !== 'external';
    const includeExternal = true;

    if (includeGrafana) {
      iterablesToMerge.push(grafanaRulesGenerator);
    }
    if (includeExternal) {
      iterablesToMerge.push(...dataSourceGenerators);
    }

    const iterable = mergeIterables(iterablesToMerge);

    return { iterable, abortController };
  };

  return getFilteredRulesIterable;
}

function mergeIterables(iterables: Array<AsyncIterableX<RuleWithOrigin>>): AsyncIterableX<RuleWithOrigin> {
  if (iterables.length === 0) {
    return emptyRulesIterable();
  }
  let acc: AsyncIterableX<RuleWithOrigin> = iterables[0];
  for (let i = 1; i < iterables.length; i++) {
    acc = merge(acc, iterables[i]);
  }
  return acc;
}

function emptyRulesIterable(): AsyncIterableX<RuleWithOrigin> {
  return from<RuleWithOrigin>([]);
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

      if (type === undefined || isSupportedExternalRulesSourceType(type) === false) {
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
