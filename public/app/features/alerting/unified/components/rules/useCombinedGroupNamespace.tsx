import { useMemo } from 'react';

import { CombinedRuleNamespace } from '../../../../../types/unified-alerting';

export function useCombinedGroupNamespace(namespaces: CombinedRuleNamespace[]) {
  return useMemo(
    () =>
      namespaces.flatMap((ns) =>
        ns.groups.map((g) => ({
          namespace: ns,
          group: g,
        }))
      ),
    [namespaces]
  );
}
