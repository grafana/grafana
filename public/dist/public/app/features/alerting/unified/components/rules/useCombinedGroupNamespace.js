import { useMemo } from 'react';
export function useCombinedGroupNamespace(namespaces) {
    return useMemo(() => namespaces.flatMap((ns) => ns.groups.map((g) => ({
        namespace: ns,
        group: g,
    }))), [namespaces]);
}
//# sourceMappingURL=useCombinedGroupNamespace.js.map