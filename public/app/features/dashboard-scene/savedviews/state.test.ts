import { type AdHocVariableFilter } from '@grafana/data';
import {
  AdHocFiltersVariable,
  QueryVariable,
  SceneTimeRange,
  SceneVariableSet,
  SceneVariableValueChangedEvent,
} from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';

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

function buildSceneWithTabFilter(filters: AdHocVariableFilter[]) {
  const sectionAdhoc = new AdHocFiltersVariable({ name: 'podFilter', datasource: null, filters });
  const tab = new TabItem({ title: 'My tab', $variables: new SceneVariableSet({ variables: [sectionAdhoc] }) });
  const scene = new DashboardScene({
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({ variables: [] }),
    body: new TabsLayoutManager({ tabs: [tab] }),
  });
  return { scene, tab };
}

describe('captureSavedViewState — tab/row-scoped section filters', () => {
  it('captures ad-hoc filters scoped to a tab, keyed by its layout path', () => {
    const { scene } = buildSceneWithTabFilter([{ key: 'pod', operator: '=', value: 'x' }]);
    const spec = captureSavedViewState(scene);

    expect(spec.sectionFilters).toEqual([
      {
        sectionKind: 'tab',
        sectionKey: '/tabs/0',
        variables: [{ name: 'podFilter', type: 'adhoc', filters: [{ key: 'pod', operator: '=', value: 'x' }] }],
      },
    ]);
  });

  it('omits sectionFilters entirely when no tab/row has its own variables', () => {
    const spec = captureSavedViewState(buildScene());

    expect(spec.sectionFilters).toBeUndefined();
  });
});

describe('applySavedViewState — tab/row-scoped section filters', () => {
  it('applies a saved section filter back onto the matching tab', () => {
    const { scene, tab } = buildSceneWithTabFilter([{ key: 'pod', operator: '=', value: 'x' }]);
    const spec = captureSavedViewState(scene);

    const live = tab.state.$variables?.getByName('podFilter');
    if (live instanceof AdHocFiltersVariable) {
      live.setState({ filters: [{ key: 'pod', operator: '=', value: 'changed' }] });
    }

    applySavedViewState(scene, spec);

    const after = tab.state.$variables?.getByName('podFilter');
    expect(after).toBeInstanceOf(AdHocFiltersVariable);
    if (after instanceof AdHocFiltersVariable) {
      expect(after.state.filters).toEqual([{ key: 'pod', operator: '=', value: 'x' }]);
    }
  });

  it('is a no-op, not a throw, when the saved layout path no longer resolves', () => {
    const { scene } = buildSceneWithTabFilter([{ key: 'pod', operator: '=', value: 'x' }]);
    const spec = captureSavedViewState(scene);

    scene.setState({ body: DefaultGridLayoutManager.fromVizPanels([]) });

    expect(() => applySavedViewState(scene, spec)).not.toThrow();
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

  it('applies a section filter for a section the current dashboard also has, merging it the same way', () => {
    const { scene, tab } = buildSceneWithTabFilter([{ key: 'pod', operator: '=', value: 'live' }]);
    const before = captureSavedViewState(scene);
    const specWithSection: SavedDashboardViewSpec = {
      ...spec,
      sectionFilters: [
        {
          sectionKind: 'tab',
          sectionKey: '/tabs/0',
          variables: [{ name: 'podFilter', type: 'adhoc', filters: [{ key: 'pod', operator: '=', value: 'saved' }] }],
        },
      ],
    };

    applySavedViewStateAsDefault(scene, specWithSection, before);

    const podFilter = tab.state.$variables?.getByName('podFilter');
    if (podFilter instanceof AdHocFiltersVariable) {
      expect(podFilter.state.filters).toEqual([{ key: 'pod', operator: '=', value: 'saved' }]);
    }
  });

  it('does not throw for a sectionFilters entry naming a section absent from the live dashboard', () => {
    const scene = buildScene();
    const before = captureSavedViewState(scene);
    const specWithSection: SavedDashboardViewSpec = {
      ...spec,
      sectionFilters: [
        {
          sectionKind: 'tab',
          sectionKey: '/tabs/0',
          variables: [{ name: 'podFilter', type: 'adhoc', filters: [{ key: 'pod', operator: '=', value: 'saved' }] }],
        },
      ],
    };

    expect(() => applySavedViewStateAsDefault(scene, specWithSection, before)).not.toThrow();
    // The rest of the spec (time range, dashboard-level variables) still applies normally.
    expect(scene.state.$timeRange?.state.from).toBe('now-24h');
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

  it('is true when a section filter value differs', () => {
    const withSection: SavedDashboardViewSpec = {
      ...base,
      sectionFilters: [
        {
          sectionKind: 'tab',
          sectionKey: '/tabs/0',
          variables: [{ name: 'pod', type: 'adhoc', filters: [{ key: 'pod', operator: '=', value: 'x' }] }],
        },
      ],
    };
    const changed: SavedDashboardViewSpec = {
      ...withSection,
      sectionFilters: [
        {
          sectionKind: 'tab',
          sectionKey: '/tabs/0',
          variables: [{ name: 'pod', type: 'adhoc', filters: [{ key: 'pod', operator: '=', value: 'y' }] }],
        },
      ],
    };
    expect(getSavedViewDiff(changed, withSection)).toBe(true);
  });

  it('is false when sectionFilters is absent on both sides', () => {
    expect(getSavedViewDiff(base, { ...base, variables: [...base.variables] })).toBe(false);
  });
});
