import { useMemo } from 'react';

import { type DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';

import { useDataSourcesForRules } from './useDataSourcesForRules';

export interface ExternalRulesSourcesResult {
  items: DataSourceRulesSourceIdentifier[];
  isLoading: boolean;
  error?: Error;
}

/**
 * The rules source identifiers of {@link useDataSourcesForRules}, in the same order. Empty while loading.
 */
export function useExternalRulesSources(): ExternalRulesSourcesResult {
  const { items, isLoading, error } = useDataSourcesForRules();

  const rulesSources = useMemo(
    () =>
      items.map(
        (ds): DataSourceRulesSourceIdentifier => ({ name: ds.name, uid: ds.uid, ruleSourceType: 'datasource' })
      ),
    [items]
  );

  return { items: rulesSources, isLoading, error };
}
