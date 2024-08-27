import { Scope } from '@grafana/data';

import { SelectedScope, TreeScope } from './types';

export function getBasicScope(name: string): Scope {
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

export function mergeScopes(scope1: Scope, scope2: Scope): Scope {
  return {
    ...scope1,
    metadata: {
      ...scope1.metadata,
      ...scope2.metadata,
    },
    spec: {
      ...scope1.spec,
      ...scope2.spec,
    },
  };
}

export function getTreeScopesFromSelectedScopes(scopes: SelectedScope[]): TreeScope[] {
  return scopes.map(({ scope, path }) => ({
    scopeName: scope.metadata.name,
    path,
  }));
}

export function getScopesFromSelectedScopes(scopes: SelectedScope[]): Scope[] {
  return scopes.map(({ scope }) => scope);
}

export function getScopeNamesFromSelectedScopes(scopes: SelectedScope[]): string[] {
  return scopes.map(({ scope }) => scope.metadata.name);
}
