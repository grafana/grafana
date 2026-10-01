import { renderHook } from '@testing-library/react';

import {
  CustomVariable,
  DataSourceVariable,
  QueryVariable,
  sceneGraph,
  SceneTimeRange,
  SceneVariableSet,
} from '@grafana/scenes';

import { DashboardScene } from '../../../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../../../scene/layout-rows/RowsLayoutManager';

import { useDraftVariable } from './useDraftVariable';

// The scene is intentionally not activated: activation would fire real variable queries,
// and useDraftVariable only walks parent links, which are set at construction time.
function buildTestScene() {
  const dsVariable = new DataSourceVariable({
    name: 'ds',
    pluginId: 'prometheus',
    value: 'gdev-prometheus',
    text: 'gdev-prometheus',
  });

  const sourceVariable = new QueryVariable({
    name: 'VariableUnderTest',
    datasource: { uid: '${ds}', type: 'prometheus' },
    query: 'label_values(__name__)',
    regex: '/.*/',
  });

  const timeRange = new SceneTimeRange({ from: 'now-6h', to: 'now' });

  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [dsVariable, sourceVariable] }),
    $timeRange: timeRange,
    body: AutoGridLayoutManager.createEmpty(),
  });

  return { dashboard, sourceVariable, dsVariable, timeRange };
}

describe('useDraftVariable(queryVariable)', () => {
  test('returns a new QueryVariable instance carrying the same config state', () => {
    const { sourceVariable } = buildTestScene();

    const { result } = renderHook(() => useDraftVariable(sourceVariable));

    const { draftVariable } = result.current;
    expect(draftVariable).toBeInstanceOf(QueryVariable);
    expect(draftVariable).not.toBe(sourceVariable);
    expect(draftVariable.state.name).toBe('VariableUnderTest');
    expect(draftVariable.state.query).toBe('label_values(__name__)');
    expect(draftVariable.state.datasource).toEqual({ uid: '${ds}', type: 'prometheus' });
    expect(draftVariable.state.regex).toBe('/.*/');
  });

  test('returns initialState as a shallow copy of the source variable state', () => {
    const { sourceVariable } = buildTestScene();

    const { result } = renderHook(() => useDraftVariable(sourceVariable));

    const { initialState } = result.current;
    expect(initialState).not.toBe(sourceVariable.state);
    expect(initialState).toEqual(sourceVariable.state);
  });

  describe('when the hook re-renders', () => {
    test('returns the same draft instance and initial state', () => {
      const { sourceVariable } = buildTestScene();
      const { result, rerender } = renderHook(() => useDraftVariable(sourceVariable));
      const { draftVariable: firstDraft, initialState: firstState } = result.current;

      rerender();

      expect(result.current.draftVariable).toBe(firstDraft);
      expect(result.current.initialState).toBe(firstState);
    });
  });

  describe('when the source variable state changes after the first render', () => {
    test('initialState keeps the original snapshot', () => {
      const { sourceVariable } = buildTestScene();
      const { result, rerender } = renderHook(() => useDraftVariable(sourceVariable));

      sourceVariable.setState({ query: 'label_values(job)' });
      rerender();

      expect(result.current.initialState.query).toBe('label_values(__name__)');
    });
  });

  describe('when the dashboard has a time range', () => {
    test('the draft has its own SceneTimeRange with the same from/to', () => {
      const { sourceVariable, timeRange } = buildTestScene();

      const { result } = renderHook(() => useDraftVariable(sourceVariable));

      const draftTimeRange = result.current.draftVariable.state.$timeRange;
      expect(draftTimeRange).toBeInstanceOf(SceneTimeRange);
      expect(draftTimeRange).not.toBe(timeRange);
      expect(draftTimeRange?.state.from).toBe('now-6h');
      expect(draftTimeRange?.state.to).toBe('now');
    });

    test('changing the dashboard time range afterwards does not affect the draft', () => {
      const { sourceVariable, timeRange } = buildTestScene();
      const { result } = renderHook(() => useDraftVariable(sourceVariable));

      timeRange.setState({ from: 'now-1h', to: 'now-30m' });

      const draftTimeRange = result.current.draftVariable.state.$timeRange;
      expect(draftTimeRange?.state.from).toBe('now-6h');
      expect(draftTimeRange?.state.to).toBe('now');
    });
  });

  describe('when the dashboard has variables', () => {
    test('the draft resolves a referenced dashboard variable to its own clone', () => {
      const { sourceVariable, dsVariable } = buildTestScene();

      const { result } = renderHook(() => useDraftVariable(sourceVariable));

      const found = sceneGraph.lookupVariable('ds', result.current.draftVariable);
      expect(found).toBeInstanceOf(DataSourceVariable);
      expect(found).not.toBe(dsVariable);
      expect(found?.getValue()).toBe('gdev-prometheus');
    });

    test('interpolating a variable reference against the draft returns the value captured at draft creation', () => {
      const { sourceVariable } = buildTestScene();

      const { result } = renderHook(() => useDraftVariable(sourceVariable));

      expect(sceneGraph.interpolate(result.current.draftVariable, '${ds}')).toBe('gdev-prometheus');
    });

    test('changing a dashboard variable value after draft creation does not affect the draft', () => {
      const { sourceVariable, dsVariable } = buildTestScene();
      const { result } = renderHook(() => useDraftVariable(sourceVariable));

      dsVariable.setState({ value: 'gdev-loki', text: 'gdev-loki' });

      expect(sceneGraph.interpolate(result.current.draftVariable, '${ds}')).toBe('gdev-prometheus');
    });

    test('the draft scope excludes the edited variable, so a self-reference resolves to nothing', () => {
      const { sourceVariable } = buildTestScene();

      const { result } = renderHook(() => useDraftVariable(sourceVariable));

      expect(sceneGraph.lookupVariable('VariableUnderTest', result.current.draftVariable)).toBeNull();
    });
  });

  describe('when the variable is section-scoped (row/tab)', () => {
    function buildSectionScopedTestScene() {
      const dsVariable = new DataSourceVariable({
        name: 'ds',
        pluginId: 'prometheus',
        value: 'gdev-prometheus',
        text: 'gdev-prometheus',
      });

      const dashboardDup = new CustomVariable({ name: 'dup', query: 'dash', value: 'dash', text: 'dash' });
      const sectionDup = new CustomVariable({ name: 'dup', query: 'section', value: 'section', text: 'section' });

      const sectionVariable = new QueryVariable({
        name: 'SectionVariableUnderTest',
        datasource: { uid: '${ds}', type: 'prometheus' },
        query: 'label_values(__name__)',
      });

      const row = new RowItem({
        title: 'Row',
        $variables: new SceneVariableSet({ variables: [sectionDup, sectionVariable] }),
        layout: AutoGridLayoutManager.createEmpty(),
      });

      const dashboard = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [dsVariable, dashboardDup] }),
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        body: new RowsLayoutManager({ rows: [row] }),
      });

      return { dashboard, sectionVariable, dsVariable };
    }

    test('the draft resolves dashboard-level variables', () => {
      const { sectionVariable, dsVariable } = buildSectionScopedTestScene();

      const { result } = renderHook(() => useDraftVariable(sectionVariable));

      const found = sceneGraph.lookupVariable('ds', result.current.draftVariable);
      expect(found).toBeInstanceOf(DataSourceVariable);
      expect(found).not.toBe(dsVariable);
      expect(sceneGraph.interpolate(result.current.draftVariable, '${ds}')).toBe('gdev-prometheus');
    });

    test('a section variable shadows a dashboard variable with the same name', () => {
      const { sectionVariable } = buildSectionScopedTestScene();

      const { result } = renderHook(() => useDraftVariable(sectionVariable));

      expect(sceneGraph.interpolate(result.current.draftVariable, '${dup}')).toBe('section');
    });
  });
});
