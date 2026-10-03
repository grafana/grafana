import { type AdHocVariableFilter } from '@grafana/data';
import {
  AdHocFiltersVariable,
  QueryVariable,
  SceneTimeRange,
  SceneVariableSet,
  SceneVariableValueChangedEvent,
} from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

import { applySavedViewState, applySavedViewStateAsDefault, captureSavedViewState, getSavedViewDiff } from './state';
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

  it('publishes SceneVariableValueChangedEvent when applying a changed ad-hoc filter', () => {
    // Regression test: a plain setState({ filters }) updates the filter-chip UI (which reads
    // state.filters directly) but never notifies dependent panels/repeats/interpolated content,
    // which listen for this event to know they need to re-run. updateFilters() is the API that
    // publishes it -- that's what this pins.
    const scene = buildScene({ adhocFilters: [{ key: 'host', operator: '=', value: 'a' }] });
    const adhoc = scene.state.$variables?.getByName('adhocFilter');
    if (!(adhoc instanceof AdHocFiltersVariable)) {
      throw new Error('expected an AdHocFiltersVariable');
    }
    const onChanged = jest.fn();
    adhoc.subscribeToEvent(SceneVariableValueChangedEvent, onChanged);

    applySavedViewState(scene, {
      dashboardUID: 'dash-1',
      name: '',
      timeRange: { from: 'now-6h', to: 'now' },
      variables: [{ name: 'adhocFilter', type: 'adhoc', filters: [{ key: 'host', operator: '=', value: 'b' }] }],
    });

    expect(onChanged).toHaveBeenCalledTimes(1);
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

describe('applySavedViewStateAsDefault', () => {
  const spec: SavedDashboardViewSpec = {
    dashboardUID: 'dash-1',
    name: 'My view',
    timeRange: { from: 'now-24h', to: 'now-1h' },
    variables: [
      { name: 'adhocFilter', type: 'adhoc', filters: [{ key: 'host', operator: '=', value: 'saved' }] },
      { name: 'env', type: 'query', value: 'staging' },
    ],
  };

  it('keeps an explicit time-range override that changed during this pass, but still defaults the untouched sub-field', () => {
    // Regression test for the merge being per-sub-field, not one atomic unit: a link like
    // "?viewFilter=view-1&from=now-15m" only changes `from` -- `to` must still pick up the saved
    // spec's value, not get skipped just because `from` was overridden.
    const scene = buildScene({ from: 'now-6h', to: 'now-1h' });
    const before = captureSavedViewState(scene);
    // Simulate $timeRange's own updateFromUrl having already applied an explicit override for
    // `from` only, during the same synchronous pass, before this deferred call runs.
    scene.state.$timeRange?.setState({ from: 'now-15m' });

    applySavedViewStateAsDefault(scene, spec, before);

    expect(scene.state.$timeRange?.state.from).toBe('now-15m'); // explicit override survives
    expect(scene.state.$timeRange?.state.to).toBe('now-1h'); // untouched -- picks up the default
  });

  it('merges variables independently: an explicitly-changed one keeps its value, an untouched one gets the default', () => {
    const scene = buildScene({ adhocFilters: [{ key: 'host', operator: '=', value: 'live' }], env: 'dev' });
    const before = captureSavedViewState(scene);
    // Simulate an explicit var-adhocFilter override landing during the same pass; env is untouched.
    const adhoc = scene.state.$variables?.getByName('adhocFilter');
    if (adhoc instanceof AdHocFiltersVariable) {
      adhoc.updateFilters([{ key: 'host', operator: '=', value: 'overridden' }]);
    }

    applySavedViewStateAsDefault(scene, spec, before);

    const afterAdhoc = scene.state.$variables?.getByName('adhocFilter');
    if (afterAdhoc instanceof AdHocFiltersVariable) {
      expect(afterAdhoc.state.filters).toEqual([{ key: 'host', operator: '=', value: 'overridden' }]);
    }
    const afterEnv = scene.state.$variables?.getByName('env');
    if (afterEnv instanceof QueryVariable) {
      expect(afterEnv.state.value).toBe('staging'); // untouched -- picks up the saved default
    }
  });

  it('leaves a variable alone if it is absent from both before and after (e.g. created after the view was saved)', () => {
    const scene = buildScene();
    const before = captureSavedViewState(scene);
    const specWithExtraVariable: SavedDashboardViewSpec = {
      ...spec,
      variables: [...spec.variables, { name: 'not-on-this-dashboard', type: 'query', value: 'x' }],
    };

    expect(() => applySavedViewStateAsDefault(scene, specWithExtraVariable, before)).not.toThrow();
    expect(scene.state.$variables?.getByName('not-on-this-dashboard')).toBeUndefined();
  });

  it('applies the saved spec in full when nothing changed during the pass (the default-view cold-load case)', () => {
    const scene = buildScene();
    const before = captureSavedViewState(scene);

    applySavedViewStateAsDefault(scene, spec, before);

    expect(scene.state.$timeRange?.state.from).toBe('now-24h');
    expect(scene.state.$timeRange?.state.to).toBe('now-1h');
    const env = scene.state.$variables?.getByName('env');
    if (env instanceof QueryVariable) {
      expect(env.state.value).toBe('staging');
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
