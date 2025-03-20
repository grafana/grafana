import { Scope } from '@grafana/data';

export function getEmptyScopeObject(name: string): Scope {
  return {
    metadata: { name },
    spec: {
      filters: [],
      title: name,
      type: '',
      category: '',
      description: '',
    },
  };
}
