import { AsyncIterableX, empty, from } from 'ix/asynciterable';
import { merge } from 'ix/asynciterable/merge';
import { catchError, flatMap, map } from 'ix/asynciterable/operators';

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
import { getDatasourceAPIUid, getExternalRulesSources } from '../../utils/datasource';

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

    const ruleSourcesToFetchFrom = filterState.dataSourceNames.length
      ? filterState.dataSourceNames.map<DataSourceRulesSourceIdentifier>((ds) => ({
          name: ds,
          uid: getDatasourceAPIUid(ds),
          ruleSourceType: 'datasource',
        }))
      : allExternalRulesSources;

    const grafanaIterator = from(grafanaGroupsGenerator(groupLimit, normalizedFilterState)).pipe(
      flatMap((group) => group.rules.map((rule) => [group, rule] as const)),
      map(([group, rule]) => mapGrafanaRuleToRuleWithOrigin(group, rule)),
      catchError(() => empty())
    );

    const sourceIterables = ruleSourcesToFetchFrom.map((ds) => {
      const generator = prometheusGroupsGenerator(ds, groupLimit, normalizedFilterState);
      return from(generator).pipe(
        map((group) => [ds, group] as const),
        catchError(() => empty())
      );
    });

    // if we have no prometheus data sources, use an empty async iterable
    const source = sourceIterables.at(0) ?? empty();
    const otherIterables = sourceIterables.slice(1);

    const dataSourcesIterator = merge(source, ...otherIterables).pipe(
      flatMap(([rulesSource, group]) => group.rules.map((rule) => [rulesSource, group, rule] as const)),
      map(([rulesSource, group, rule]) => mapRuleToRuleWithOrigin(rulesSource, group, rule))
    );

    return merge(grafanaIterator, dataSourcesIterator);
  };

  return { getFilteredRulesIterator };
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
