import { ScopedResourceServer } from '../apiserver/server';
import { ResourceServer } from '../apiserver/types';

// This must match -- manual for now, soon we can add codegen
// https://github.com/grafana/grafana/blob/main/pkg/apis/scope/v0alpha1/types.go#L15
interface ScopeSpec {
  title: string;
  type: string;
  description: string;
  category: string;
  filters: ScopeFilter[];
}

interface ScopeFilter {
  key: string;
  value: string;
  operator: string;
}

export function NewScopeServer(): ResourceServer<ScopeSpec> {
  return new ScopedResourceServer({
    group: 'scope.grafana.app',
    version: 'v0alpha1',
    resource: 'scopes',
  });
}
