import { CombinedRule } from 'app/types/unified-alerting';

import { useCombinedRulesByDashboard } from './useCombinedRule';

interface Options {
  dashboardUID: string;
  panelId: number;

  poll?: boolean;
}

interface ReturnBag {
  errors: unknown[];
  rules: CombinedRule[];

  loading?: boolean;
}

export function usePanelCombinedRules({ dashboardUID, panelId, poll = false }: Options): ReturnBag {
  const { result: combinedNamespaces, loading, error } = useCombinedRulesByDashboard(dashboardUID, panelId);
  const rules = combinedNamespaces ? combinedNamespaces.flatMap((ns) => ns.groups).flatMap((group) => group.rules) : [];

  return {
    rules,
    errors: error ? [error] : [],
    loading,
  };
}
