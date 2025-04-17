import { Scope } from '@grafana/data';

export function getEmptyScopeObject(name: string, title?: string): Scope {
  return {
    metadata: { name },
    spec: {
      filters: [],
      title: title || name,
      type: '',
      category: '',
      description: '',
    },
  };
}
