import { type DataFrame, FieldType, LoadingState, type PanelData } from '@grafana/data';
import { SceneDataNode, VizPanel } from '@grafana/scenes';

import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingData, dataFramesHaveValues } from './ConditionalRenderingData';

describe('ConditionalRenderingData', () => {
  it('ignores time-only and null-only frames', () => {
    expect(dataFramesHaveValues([frame([{ type: FieldType.time, values: [1, 2] }])])).toBe(false);
    expect(dataFramesHaveValues([frame([{ type: FieldType.number, values: [null, undefined] }])])).toBe(false);
    expect(dataFramesHaveValues([frame([{ type: FieldType.number, values: [0] }])])).toBe(true);
  });

  it('evaluates row data conditions from child panel data providers', () => {
    const { condition, group, deactivate } = buildRowCondition(false, [
      dataNode([frame([{ type: FieldType.number, values: [null] }])]),
      dataNode([frame([{ type: FieldType.number, values: [42] }])]),
    ]);

    expect(condition.state.result).toBe(false);
    expect(group.state.result).toBe(false);

    deactivate();
  });

  it('matches a row no-data condition only when all child panels have no data', () => {
    const { condition, group, deactivate } = buildRowCondition(false, [
      dataNode([frame([{ type: FieldType.number, values: [null] }])]),
      dataNode([]),
    ]);

    expect(condition.state.result).toBe(true);
    expect(group.state.result).toBe(true);

    deactivate();
  });

  it('treats a row with no child data providers as no data', () => {
    const { condition, group, deactivate } = buildRowCondition(false, []);

    expect(condition.state.result).toBe(true);
    expect(group.state.result).toBe(true);

    deactivate();
  });

  it('matches as soon as any child panel has data', () => {
    const loadingDataNode = dataNode([frame([{ type: FieldType.number, values: [1] }])], LoadingState.Loading);
    const { condition, group, deactivate } = buildRowCondition(true, [
      dataNode([frame([{ type: FieldType.number, values: [1] }])]),
      loadingDataNode,
    ]);

    expect(condition.state.result).toBe(true);
    expect(group.state.result).toBe(true);

    loadingDataNode.setState({
      data: panelData([frame([{ type: FieldType.number, values: [1] }])]),
    });

    expect(condition.state.result).toBe(true);
    expect(group.state.result).toBe(true);

    deactivate();
  });

  it('waits while no child panel has data and some child panel data is still loading', () => {
    const { condition, group, deactivate } = buildRowCondition(true, [
      dataNode([]),
      dataNode([frame([{ type: FieldType.number, values: [1] }])], LoadingState.Loading),
    ]);

    expect(condition.state.result).toBeUndefined();
    expect(group.state.result).toBe(false);

    deactivate();
  });

  it('keeps the previous row visibility while refreshing child panel data', () => {
    const dataProvider = dataNode([frame([{ type: FieldType.number, values: [1] }])]);
    const { group, deactivate } = buildRowCondition(true, [dataProvider]);

    expect(group.state.result).toBe(true);

    dataProvider.setState({
      data: panelData([frame([{ type: FieldType.number, values: [1] }])], LoadingState.Loading),
    });

    expect(group.state.result).toBe(true);

    dataProvider.setState({
      data: panelData([]),
    });

    expect(group.state.result).toBe(false);

    dataProvider.setState({
      data: panelData([], LoadingState.Loading),
    });

    expect(group.state.result).toBe(false);

    deactivate();
  });
});

function buildRowCondition(value: boolean, dataNodes: SceneDataNode[]) {
  const condition = new ConditionalRenderingData({ value, result: undefined });
  const group = new ConditionalRenderingGroup({
    condition: 'and',
    visibility: 'show',
    conditions: [condition],
    result: false,
    renderHidden: true,
    hasResolved: false,
  });
  const layout = AutoGridLayoutManager.createEmpty();

  layout.state.layout.setState({
    children: dataNodes.map((dataNode, index) => {
      return new AutoGridItem({
        body: new VizPanel({
          key: `panel-${index}`,
          pluginId: 'timeseries',
          $data: dataNode,
        }),
      });
    }),
  });

  const row = new RowItem({ conditionalRendering: group, layout });
  group.setTarget(row);

  return { condition, group, deactivate: group.activate() };
}

function dataNode(series: DataFrame[], state = LoadingState.Done): SceneDataNode {
  return new SceneDataNode({ data: panelData(series, state) });
}

function panelData(series: DataFrame[], state = LoadingState.Done): PanelData {
  return { state, series } as PanelData;
}

function frame(fields: Array<{ type: FieldType; values: unknown[] }>): DataFrame {
  return {
    fields: fields.map((field, index) => ({
      name: `field-${index}`,
      type: field.type,
      config: {},
      values: field.values,
    })),
    length: fields[0]?.values.length ?? 0,
  } as DataFrame;
}
