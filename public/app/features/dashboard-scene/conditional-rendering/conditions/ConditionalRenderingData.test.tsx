import { LoadingState, toDataFrame } from '@grafana/data';
import { SceneDataNode, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingData } from './ConditionalRenderingData';

function dataNode(values: number[]) {
  const timeRange = new SceneTimeRange({ from: 'now-6h', to: 'now' }).state.value;
  return new SceneDataNode({
    data: {
      state: LoadingState.Done,
      series: [toDataFrame({ fields: [{ name: 'value', values }] })],
      timeRange,
    },
  });
}

function buildScene() {
  const condition = new ConditionalRenderingData({ value: true, result: undefined });
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', $data: dataNode([1, 2, 3]) });
  const gridItem = new AutoGridItem({
    body: panel,
    conditionalRendering: new ConditionalRenderingGroup({
      condition: 'and',
      visibility: 'show',
      conditions: [condition],
      result: true,
      renderHidden: false,
    }),
  });
  new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [gridItem] }) }),
  });

  // Only the layout item is active, as while panel edit holds it and the panel preview is unmounted,
  // so the condition is the provider's only owner.
  const deactivate = gridItem.activate();

  return { condition, panel, deactivate };
}

describe('ConditionalRenderingData', () => {
  it('follows a replacement data provider and releases the previous one', () => {
    const { condition, panel, deactivate } = buildScene();
    const original = panel.state.$data!;
    expect(condition.state.result).toBe(true);

    const replacement = dataNode([]);
    panel.setState({ $data: replacement });

    expect(original.isActive).toBe(false);
    expect(condition.state.result).toBe(false);

    replacement.setState({
      data: { ...replacement.state.data, series: [toDataFrame({ fields: [{ name: 'v', values: [1] }] })] },
    });
    expect(condition.state.result).toBe(true);

    deactivate();
    expect(replacement.isActive).toBe(false);
  });

  it('releases the data provider when the panel stops querying', () => {
    const { condition, panel } = buildScene();
    const original = panel.state.$data!;

    panel.setState({ $data: undefined });

    expect(original.isActive).toBe(false);
    // Without a provider of its own, the panel falls back to the scene's empty data, as a non-query panel does.
    expect(condition.state.result).toBe(false);
  });
});
