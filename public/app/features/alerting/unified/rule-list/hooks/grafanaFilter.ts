import { attempt, isError } from 'lodash';

import { type PromRuleDTO, type PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { type GrafanaPromRulesOptions } from '../../api/prometheusApi';
import { type RulesFilter } from '../../search/rulesSearchParser';
import { parseMatcher } from '../../utils/matchers';

import { buildTitleSearch, normalizeFilterState } from './filterNormalization';
import { mapDataSourceNamesToUids, policyFilter } from './filterPredicates';

/**
 * Determines if client-side filtering is needed for Grafana-managed rules.
 * All filters except `policy` are handled by the backend; policy filtering is always client-side
 * as the backend API does not support it.
 */
export function hasGrafanaClientSideFilters(filterState: Partial<RulesFilter>): boolean {
  return Boolean(filterState.policy);
}

/**
 * Builds a combined filter for Grafana-managed alert rules.
 *
 * All filters are passed to the backend except `policy`, which the backend API does not support
 * and is applied client-side.
 */
export function getGrafanaFilter(filterState: Partial<RulesFilter>) {
  const normalizedFilterState = normalizeFilterState(filterState);

  const titleSearch = buildTitleSearch(normalizedFilterState);

  let hasInvalidDataSourceNames = false;
  let datasourceUids: string[] | undefined = undefined;

  if (normalizedFilterState.dataSourceNames.length > 0) {
    datasourceUids = mapDataSourceNamesToUids(normalizedFilterState.dataSourceNames);
    hasInvalidDataSourceNames = datasourceUids.length === 0;
  }

  const ruleMatchersBackendFilter: string[] | undefined =
    normalizedFilterState.labels.length === 0 ? undefined : labelMatchersToBackendFormat(normalizedFilterState.labels);

  const backendFilter: GrafanaPromRulesOptions = {
    state: normalizedFilterState.ruleState ? [normalizedFilterState.ruleState] : [],
    health: normalizedFilterState.ruleHealth ? [normalizedFilterState.ruleHealth] : [],
    contactPoint: normalizedFilterState.contactPoint ?? undefined,
    title: titleSearch,
    type: normalizedFilterState.ruleType,
    dashboardUid: normalizedFilterState.dashboardUid,
    searchGroupName: normalizedFilterState.groupName,
    datasources: datasourceUids,
    ruleMatchers: ruleMatchersBackendFilter,
    plugins: normalizedFilterState.plugins,
    searchFolder: normalizedFilterState.namespace,
  };

  return {
    backendFilter,
    frontendFilter: {
      groupMatches: (_group: PromRuleGroupDTO) => true,
      ruleMatches: (rule: PromRuleDTO) => policyFilter(rule, normalizedFilterState),
    },
    hasInvalidDataSourceNames,
  };
}

/**
 * Converts label matchers to JSON-encoded strings for backend filtering.
 * Invalid matchers are logged and filtered out.
 */
function labelMatchersToBackendFormat(labels: string[]): string[] {
  return labels.reduce<string[]>((acc, label) => {
    const result = attempt(() => JSON.stringify(parseMatcher(label)));

    if (isError(result)) {
      console.warn('Failed to parse label matcher:', label, result);
    } else {
      acc.push(result);
    }

    return acc;
  }, []);
}
