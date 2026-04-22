import { CustomVariable } from '@grafana/scenes';
import { defaultCustomVariableKind, defaultQueryVariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  getGlobalSceneVariableScope,
  isGlobalSceneVariable,
  markAsGlobalSceneVariable,
  sortGlobalVariableDefaults,
  tagVariableKindAsGlobalDefault,
} from './globalDashboardVariables';

describe('globalDashboardVariables', () => {
  it('tagVariableKindAsGlobalDefault stamps datasource-shaped origin for org scope', () => {
    const v = defaultCustomVariableKind();
    v.spec.name = 'region';
    const { kind, scope } = tagVariableKindAsGlobalDefault(v, 'org');
    // We reuse the narrow datasource origin shape so the serializer's
    // `origin !== undefined` persistence skip keeps working, without widening the schema.
    expect(kind.spec.origin).toEqual({ type: 'datasource', group: 'org' });
    expect(scope).toBe('org');
  });

  it('tagVariableKindAsGlobalDefault uses folder uid as scope when provided', () => {
    const v = defaultCustomVariableKind();
    v.spec.name = 'env';
    const { kind, scope } = tagVariableKindAsGlobalDefault(v, 'folder', 'folder-abc');
    expect(kind.spec.origin).toEqual({ type: 'datasource', group: 'folder-abc' });
    expect(scope).toBe('folder-abc');
  });

  it('sortGlobalVariableDefaults sorts by scope then name', () => {
    const a = tagVariableKindAsGlobalDefault(defaultCustomVariableKind(), 'folder', 'zeta');
    a.kind.spec.name = 'a';
    const b = tagVariableKindAsGlobalDefault(defaultQueryVariableKind(), 'org');
    b.kind.spec.name = 'b';
    const c = tagVariableKindAsGlobalDefault(defaultCustomVariableKind(), 'folder', 'alpha');
    c.kind.spec.name = 'c';

    const sorted = sortGlobalVariableDefaults([a, b, c]);
    expect(sorted.map((d) => d.kind.spec.name)).toEqual(['c', 'b', 'a']);
  });

  it('markAsGlobalSceneVariable / isGlobalSceneVariable / getGlobalSceneVariableScope round-trip', () => {
    const plain = new CustomVariable({ name: 'plain', query: '' });
    const global = new CustomVariable({ name: 'global', query: '' });

    markAsGlobalSceneVariable(global, 'org');

    expect(isGlobalSceneVariable(plain)).toBe(false);
    expect(getGlobalSceneVariableScope(plain)).toBeUndefined();
    expect(isGlobalSceneVariable(global)).toBe(true);
    expect(getGlobalSceneVariableScope(global)).toBe('org');
  });
});
