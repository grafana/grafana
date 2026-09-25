import { type AdHocVariableFilter } from '@grafana/data';
import { AdHocFiltersVariable, QueryVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

import { applySavedViewState, captureSavedViewState, getSavedViewDiff } from './state';
import { type SavedDashboardViewSpec } from './types';

function buildScene(overrides?: { from?: string; to?: string; adhocFilters?: AdHocVariableFilter[]; env?: string }) {
  const adhoc = new AdHocFiltersVariable({
    name: 'adhocFilter',
    datasource: null,
    filters: overrides?.adhocFilters ?? [{ key: 'host', operator: '=', value: 'a' }],
  });
  const env = new QueryVariable({
    name: 'env',
    query: 'label_values(env)',
    value: overrides?.env ?? 'prod',
    text: overrides?.env ?? 'prod',
  });

  return new DashboardScene({
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({ from: overrides?.from ?? 'now-6h', to: overrides?.to ?? 'now' }),
    $variables: new SceneVariableSet({ variables: [adhoc, env] }),
  });
}

describe('captureSavedViewState', () => {
  it('reads dashboardUID, time range, and variable values off the scene', () => {
    const scene = buildScene();
    const spec = captureSavedViewState(scene);

    expect(spec.dashboardUID).toBe('dash-1');
    expect(spec.name).toBe('');
    expect(spec.timeRange).toEqual({ from: 'now-6h', to: 'now' });
    expect(spec.variables).toEqual([
      { name: 'adhocFilter', type: 'adhoc', filters: [{ key: 'host', operator: '=', value: 'a' }] },
      { name: 'env', type: 'query', value: 'prod' },
    ]);
  });
});

describe('applySavedViewState', () => {
  it('pushes a captured spec onto a scene with different starting values', () => {
    const scene = buildScene({ from: 'now-1h', to: 'now', adhocFilters: [], env: 'dev' });
    const spec: SavedDashboardViewSpec = {
      dashboardUID: 'dash-1',
      name: 'My view',
      timeRange: { from: 'now-24h', to: 'now-1h' },
      variables: [
        { name: 'adhocFilter', type: 'adhoc', filters: [{ key: 'host', operator: '=', value: 'b' }] },
        { name: 'env', type: 'query', value: 'prod' },
      ],
    };

    applySavedViewState(scene, spec);

    expect(scene.state.$timeRange?.state.from).toBe('now-24h');
    expect(scene.state.$timeRange?.state.to).toBe('now-1h');

    const adhoc = scene.state.$variables?.getByName('adhocFilter');
    expect(adhoc).toBeInstanceOf(AdHocFiltersVariable);
    if (adhoc instanceof AdHocFiltersVariable) {
      expect(adhoc.state.filters).toEqual([{ key: 'host', operator: '=', value: 'b' }]);
    }

    const env = scene.state.$variables?.getByName('env');
    expect(env).toBeInstanceOf(QueryVariable);
    if (env instanceof QueryVariable) {
      expect(env.state.value).toBe('prod');
    }
  });

  it('round-trips through capture → apply → capture unchanged', () => {
    const source = buildScene({
      from: 'now-12h',
      to: 'now-2h',
      adhocFilters: [{ key: 'k', operator: '!=', value: 'v' }],
      env: 'staging',
    });
    const captured = captureSavedViewState(source);

    const target = buildScene(); // different starting values
    applySavedViewState(target, captured);
    const recaptured = captureSavedViewState(target);

    expect(recaptured).toEqual(captured);
  });

  it('leaves a variable alone when the spec has no matching name', () => {
    const scene = buildScene({ env: 'dev' });
    applySavedViewState(scene, {
      dashboardUID: 'dash-1',
      name: '',
      timeRange: { from: 'now-6h', to: 'now' },
      variables: [{ name: 'does-not-exist', type: 'query', value: 'x' }],
    });

    const env = scene.state.$variables?.getByName('env');
    expect(env).toBeInstanceOf(QueryVariable);
    if (env instanceof QueryVariable) {
      expect(env.state.value).toBe('dev');
    }
  });
});

describe('getSavedViewDiff', () => {
  const base: SavedDashboardViewSpec = {
    dashboardUID: 'dash-1',
    name: 'view',
    timeRange: { from: 'now-6h', to: 'now' },
    variables: [{ name: 'env', type: 'query', value: 'prod' }],
  };

  it('is false for identical specs', () => {
    expect(getSavedViewDiff(base, { ...base, variables: [...base.variables] })).toBe(false);
  });

  it('is true when the time range differs', () => {
    expect(getSavedViewDiff({ ...base, timeRange: { from: 'now-1h', to: 'now' } }, base)).toBe(true);
  });

  it('is true when a variable value differs', () => {
    const changed = { ...base, variables: [{ name: 'env', type: 'query' as const, value: 'dev' }] };
    expect(getSavedViewDiff(changed, base)).toBe(true);
  });

  it('is true when the set of variables differs', () => {
    const changed = { ...base, variables: [] };
    expect(getSavedViewDiff(changed, base)).toBe(true);
  });
});
