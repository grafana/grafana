import { DataFrame, getDefaultTimeRange, LoadingState, PanelData, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, VizPanel } from '@grafana/scenes';

import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { activateFullSceneTree } from '../../utils/test-utils';
import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingData } from './ConditionalRenderingData';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

const seriesWithData = toDataFrame({ fields: [{ name: 'value', values: [1, 2, 3] }] });
const emptySeries = toDataFrame({ fields: [{ name: 'value', values: [] }] });

function buildPanelData(overrides: Partial<PanelData> = {}): PanelData {
  return {
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
    ...overrides,
  };
}

function buildSceneTree({
  condition,
  series,
  loadingState = LoadingState.Done,
}: {
  condition: ConditionalRenderingData;
  series: DataFrame[];
  loadingState?: LoadingState;
}) {
  const group = new ConditionalRenderingGroup({
    conditions: [condition],
    condition: 'and',
    visibility: 'show',
    result: true,
    renderHidden: true,
  });

  const dataNode = new SceneDataNode({
    data: buildPanelData({ state: loadingState, series }),
  });

  const gridItem = new AutoGridItem({
    body: new VizPanel({ title: 'Test Panel', pluginId: 'timeseries', $data: dataNode }),
    conditionalRendering: group,
  });

  return { group, gridItem, dataNode };
}

describe('ConditionalRenderingData', () => {
  describe('evaluation', () => {
    test('when value=true and data provider has series with rows, result is true', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { gridItem } = buildSceneTree({ condition, series: [seriesWithData] });

      activateFullSceneTree(gridItem);

      expect(condition.state.result).toBe(true);
    });

    test('when value=true and data provider has only empty series, result is false', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { gridItem } = buildSceneTree({ condition, series: [emptySeries] });

      activateFullSceneTree(gridItem);

      expect(condition.state.result).toBe(false);
    });

    test('when value=true and data provider has no series at all, result is false', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { gridItem } = buildSceneTree({ condition, series: [] });

      activateFullSceneTree(gridItem);

      expect(condition.state.result).toBe(false);
    });

    test('when value=true and data provider has mixed series, result is true', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { gridItem } = buildSceneTree({ condition, series: [emptySeries, seriesWithData, emptySeries] });

      activateFullSceneTree(gridItem);

      expect(condition.state.result).toBe(true);
    });

    test('when value=false and data provider has series with rows, result is false', () => {
      const condition = new ConditionalRenderingData({ value: false, result: undefined });
      const { gridItem } = buildSceneTree({ condition, series: [seriesWithData] });

      activateFullSceneTree(gridItem);

      expect(condition.state.result).toBe(false);
    });

    test('when value=false and data provider has only empty series, result is true', () => {
      const condition = new ConditionalRenderingData({ value: false, result: undefined });
      const { gridItem } = buildSceneTree({ condition, series: [emptySeries] });

      activateFullSceneTree(gridItem);

      expect(condition.state.result).toBe(true);
    });

    test('when data provider is in Loading state, result is undefined', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { gridItem } = buildSceneTree({ condition, series: [seriesWithData], loadingState: LoadingState.Loading });

      activateFullSceneTree(gridItem);

      expect(condition.state.result).toBeUndefined();
    });

    test('when data provider is in NotStarted state, result is undefined', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { gridItem } = buildSceneTree({
        condition,
        series: [seriesWithData],
        loadingState: LoadingState.NotStarted,
      });

      activateFullSceneTree(gridItem);

      expect(condition.state.result).toBeUndefined();
    });

    test('when no panel exists in the parent, result is undefined', () => {
      const dataCondition = new ConditionalRenderingData({ value: true, result: undefined });
      const group = new ConditionalRenderingGroup({
        conditions: [dataCondition],
        condition: 'and',
        visibility: 'show',
        result: true,
        renderHidden: true,
      });

      activateFullSceneTree(group);

      expect(dataCondition.state.result).toBeUndefined();
    });
  });

  describe('reactivity', () => {
    test('when data provider state changes, result is recalculated', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { gridItem, dataNode } = buildSceneTree({ condition, series: [] });

      activateFullSceneTree(gridItem);

      dataNode.setState({ data: buildPanelData({ series: [seriesWithData] }) });

      expect(condition.state.result).toBe(true);
    });

    test('when result changes, it triggers a group check', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { group, gridItem, dataNode } = buildSceneTree({ condition, series: [] });

      activateFullSceneTree(gridItem);

      const checkSpy = jest.spyOn(group, 'check');

      dataNode.setState({ data: buildPanelData({ series: [seriesWithData] }) });

      expect(checkSpy).toHaveBeenCalled();
    });
  });

  describe('changeValue', () => {
    test('when value changes, result is recalculated', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { gridItem } = buildSceneTree({ condition, series: [seriesWithData] });

      activateFullSceneTree(gridItem);

      condition.changeValue(false);

      expect(condition.state.result).toBe(false);
    });

    test('when value is set to the same value, state and result are not updated', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });
      const { gridItem } = buildSceneTree({ condition, series: [seriesWithData] });

      activateFullSceneTree(gridItem);

      const resultBefore = condition.state.result;
      const setStateSpy = jest.spyOn(condition, 'setState');

      condition.changeValue(true);

      expect(setStateSpy).not.toHaveBeenCalled();
      expect(condition.state.result).toBe(resultBefore);
    });
  });

  describe('serialization', () => {
    test('serialize() returns the correct kind and spec', () => {
      const condition = new ConditionalRenderingData({ value: true, result: undefined });

      const result = condition.serialize();

      expect(result).toEqual({
        kind: 'ConditionalRenderingData',
        spec: { value: true },
      });
    });

    test('deserialize() creates an instance with the correct state', () => {
      const model = { kind: 'ConditionalRenderingData' as const, spec: { value: false } };

      const condition = ConditionalRenderingData.deserialize(model);

      expect(condition).toBeInstanceOf(ConditionalRenderingData);
      expect(condition.state.value).toBe(false);
      expect(condition.state.result).toBeUndefined();
    });
  });

  test('createEmpty() defaults to value=true and result=undefined', () => {
    const condition = ConditionalRenderingData.createEmpty();

    expect(condition).toBeInstanceOf(ConditionalRenderingData);
    expect(condition.state.value).toBe(true);
    expect(condition.state.result).toBeUndefined();
  });
});
