import { useMemo } from 'react';

import { type RulesSourceDataSource, useRulesSourceDataSources } from '@grafana/alerting/internal';

import { useExternalGlobalRuleAbility } from './abilities/rules/ruleAbilities';
import { ExternalRuleAction } from './abilities/types';

const collator = new Intl.Collator();
const noDataSources: RulesSourceDataSource[] = [];

export interface DataSourcesForRulesResult {
  items: RulesSourceDataSource[];
  isLoading: boolean;
  error?: Error;
}

/**
 * The data sources that the user can view or create data source-managed rules in: the supported rules source
 * types that manage alerts, sorted by name. Empty while loading.
 */
export function useDataSourcesForRules(): DataSourcesForRulesResult {
  const canView = useExternalGlobalRuleAbility(ExternalRuleAction.ViewAlertRule).granted;
  const canCreate = useExternalGlobalRuleAbility(ExternalRuleAction.CreateAlertRule).granted;
  const { items, isLoading, error } = useRulesSourceDataSources();

  const dataSources = useMemo(() => {
    if (!canView && !canCreate) {
      return noDataSources;
    }
    return items.filter((ds) => ds.managesAlerts).sort((a, b) => collator.compare(a.name, b.name));
  }, [items, canView, canCreate]);

  return { items: dataSources, isLoading, error };
}
