import { CombinedRule } from 'app/types/unified-alerting';

import { useCombinedRules } from './useCombinedRuleNamespaces';

interface Options {
  dashboardUID: string | null;
  panelId: number;

  poll?: boolean;
}

interface ReturnBag {
  errors: unknown[];
  rules: CombinedRule[];

  loading?: boolean;
}

export function usePanelCombinedRules({ dashboardUID, panelId, poll = false }: Options): ReturnBag {
  const { result: combinedNamespaces, loading, error } = useCombinedRules(dashboardUID, panelId, poll);
  const rules = combinedNamespaces ? combinedNamespaces.flatMap((ns) => ns.groups).flatMap((group) => group.rules) : [];

  return {
    rules,
    errors: error ? [error] : [],
    loading,
  };
}
