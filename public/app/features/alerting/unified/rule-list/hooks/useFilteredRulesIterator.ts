import { AsyncIterableX, from } from 'ix/asynciterable';
import { empty } from 'ix/asynciterable/empty';
import { merge } from 'ix/asynciterable/merge';
import { catchError, concatMap, withAbort } from 'ix/asynciterable/operators';

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

import { shouldUseBackendFilters } from '../../featureToggles';
import { RuleSource, RulesFilter } from '../../search/rulesSearchParser';
import {
  getDataSourceByUid,
  getDatasourceAPIUid,
  getExternalRulesSources,
  isSupportedExternalRulesSourceType,
} from '../../utils/datasource';
import { RulePositionHash, createRulePositionHash } from '../rulePositionHash';

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
  /**
   * Position hash encoding both the rule's index and the total number of rules in the group.
   * Format: "<index>:<totalRules>" (e.g., "0:3", "1:5")
   *
   * This is used as a tiebreaker when multiple identical rules exist in a group and need to be
   * matched against their counterparts in another rule source (e.g., matching Prometheus rules
   * to Ruler API rules). The hash ensures that identical rules are matched by their position
   * only when both groups have the same structure (same number of rules).
   *
   * @example
   * // Two identical alerts in different positions
   * Rule at position 0 in a 3-rule group: rulePositionHash = "0:3"
   * Rule at position 1 in a 3-rule group: rulePositionHash = "1:3"
   * // These won't match rules in a 2-rule group (e.g., "0:2") even if identical
   */
  rulePositionHash: RulePositionHash;
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
    const useBackendFilters = shouldUseBackendFilters();

    const titleSearch = useBackendFilters
      ? filterState.ruleName || (filterState.freeFormWords.length > 0 ? filterState.freeFormWords.join(' ') : undefined)
      : undefined;

    const grafanaRulesGenerator: AsyncIterableX<RuleWithOrigin> = from(
      grafanaGroupsGenerator(groupLimit, {
        contactPoint: filterState.contactPoint ?? undefined,
        health: filterState.ruleHealth ? [filterState.ruleHealth] : [],
        state: filterState.ruleState ? [filterState.ruleState] : [],
        title: titleSearch,
      })
    ).pipe(
      withAbort(abortController.signal),
      concatMap((groups) =>
        groups
          .filter((group) => groupFilter(group, normalizedFilterState))
          .flatMap((group) => group.rules.map((rule) => ({ group, rule })))
          .filter(({ rule }) => ruleFilter(rule, normalizedFilterState, useBackendFilters))
          .map(({ group, rule }) => mapGrafanaRuleToRuleWithOrigin(group, rule))
      ),
      catchError(() => empty())
    );

    // Determine which data sources to use
    const externalRulesSourcesToFetchFrom = hasDataSourceFilterActive
      ? getRulesSourcesFromFilter(filterState)
      : allExternalRulesSources;

    if (filterState.ruleSource === RuleSource.Grafana) {
      return { iterable: grafanaRulesGenerator, abortController };
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
              .flatMap((group) => group.rules.map((rule, index) => ({ group, rule, index })))
              .filter(({ rule }) => ruleFilter(rule, normalizedFilterState, false))
              .map(({ group, rule, index }) => mapRuleToRuleWithOrigin(dataSourceIdentifier, group, rule, index))
          ),
          catchError(() => empty())
        );

        return promGroupsGenerator;
      }
    );

    const iterablesToMerge: Array<AsyncIterableX<RuleWithOrigin>> = [];
    const includeGrafana = filterState.ruleSource !== 'datasource';
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

/**
 * Determines if client-side filtering is needed for Grafana-managed rules.
 */
export function hasClientSideFilters(filterState: RulesFilter): boolean {
  const useBackendFilters = shouldUseBackendFilters();

  return (
    // When backend filters are disabled, title search needs client-side filtering
    (!useBackendFilters && (filterState.freeFormWords.length > 0 || Boolean(filterState.ruleName))) ||
    // Client-side only filters:
    Boolean(filterState.namespace) ||
    filterState.dataSourceNames.length > 0 ||
    filterState.labels.length > 0 ||
    Boolean(filterState.dashboardUid) ||
    filterState.ruleSource === RuleSource.DataSource
  );
}

function mergeIterables(iterables: Array<AsyncIterableX<RuleWithOrigin>>): AsyncIterableX<RuleWithOrigin> {
  if (iterables.length === 0) {
    return empty();
  }
  const [firstIterable, ...rest] = iterables;
  return merge(firstIterable, ...rest);
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
  rule: PromRuleDTO,
  ruleIndex: number
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
    rulePositionHash: createRulePositionHash(ruleIndex, group.rules.length),
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
