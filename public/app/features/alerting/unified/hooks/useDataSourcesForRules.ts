import { useMemo } from 'react';

import {
  type RulesSourceDataSource,
  getRulesSourceDataSources,
  useRulesSourceDataSources,
} from '@grafana/alerting/internal';

import { getExternalGlobalRuleAbility, useExternalGlobalRuleAbility } from './abilities/rules/ruleAbilities';
import { ExternalRuleAction } from './abilities/types';

const collator = new Intl.Collator();
const noDataSources: RulesSourceDataSource[] = [];

export interface DataSourcesForRulesResult {
  items: RulesSourceDataSource[];
  isLoading: boolean;
  error?: Error;
}

function narrowToDataSourcesForRules(
  items: RulesSourceDataSource[],
  canViewOrCreate: boolean
): RulesSourceDataSource[] {
  if (!canViewOrCreate) {
    return noDataSources;
  }
  return items.filter((ds) => ds.managesAlerts).sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * The data sources that the user can view or create data source-managed rules in: the supported rules source
 * types that manage alerts, sorted by name. Empty while loading. Empty, not loading and without an error for a
 * user who cannot view or create data source-managed rules.
 */
export function useDataSourcesForRules(): DataSourcesForRulesResult {
  const canView = useExternalGlobalRuleAbility(ExternalRuleAction.ViewAlertRule).granted;
  const canCreate = useExternalGlobalRuleAbility(ExternalRuleAction.CreateAlertRule).granted;
  const hasAccess = canView || canCreate;
  const { items, isLoading, error } = useRulesSourceDataSources();

  const dataSources = useMemo(() => narrowToDataSourcesForRules(items, hasAccess), [items, hasAccess]);

  // A user who cannot use data source-managed rules does not need the list, so its loading state and error do not apply.
  if (!hasAccess) {
    return { items: noDataSources, isLoading: false };
  }

  return { items: dataSources, isLoading, error };
}

/**
 * The async version of {@link useDataSourcesForRules}, for code that runs outside React or inside async callbacks.
 */
export async function getDataSourcesForRules(): Promise<RulesSourceDataSource[]> {
  const canView = getExternalGlobalRuleAbility(ExternalRuleAction.ViewAlertRule).granted;
  const canCreate = getExternalGlobalRuleAbility(ExternalRuleAction.CreateAlertRule).granted;
  if (!canView && !canCreate) {
    return noDataSources;
  }
  return narrowToDataSourcesForRules(await getRulesSourceDataSources(), true);
}
