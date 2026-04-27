import type { Scope } from '@grafana/data/types';

export function getEmptyScopeObject(name: string, title?: string): Scope {
  return {
    metadata: { name },
    spec: {
      filters: [],
      title: title || name,
    },
  };
}
