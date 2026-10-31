import { FieldType, getDefaultTimeRange, LoadingState, type PanelData, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';
import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingData } from './ConditionalRenderingData';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

function panelData(state: LoadingState, rowCount: number): PanelData {
  const values = Array.from({ length: rowCount }, (_, index) => index);

  return {
    state,
    series: [toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values }] })],
    timeRange: getDefaultTimeRange(),
  };
}

/**
 * Mounts a panel carrying a "Query result" condition in an auto grid, the layout a panel hidden by
 * that rule actually sits in.
 */
async function buildScene(initial: PanelData, value = true) {
  const data = new SceneDataNode({ data: initial });
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'Panel A', $data: data });
  const condition = new ConditionalRenderingData({ value, result: undefined });
  const group = new ConditionalRenderingGroup({
    condition: 'and',
    visibility: 'show',
    conditions: [condition],
    result: true,
    renderHidden: false,
  });
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: { canEdit: true },
    body: new AutoGridLayoutManager({
      layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel, conditionalRendering: group })] }),
    }),
  });

  activateFullSceneTree(scene);
  await new Promise((resolve) => setTimeout(resolve, 10));

  return { data, condition, group };
}

describe('ConditionalRenderingData', () => {
  it('keeps the last completed result while the query is loading', async () => {
    const { data, condition, group } = await buildScene(panelData(LoadingState.Done, 0));

    // "Has data" and the query returned nothing, so the panel is hidden.
    expect(condition.state.result).toBe(false);
    expect(group.state.result).toBe(false);

    // A refresh or variable change puts the query back into the loading state.
    data.setState({ data: panelData(LoadingState.Loading, 0) });

    // The group treats an `undefined` result as "no valid conditions" and falls back to `true`, so
    // dropping the result here flashes the hidden panel on every load. The last fact must survive.
    expect(condition.state.result).toBe(false);
    expect(group.state.result).toBe(false);
  });

  it('holds the last completed result for a "No data" rule too', async () => {
    const { data, condition } = await buildScene(panelData(LoadingState.Done, 3), false);

    expect(condition.state.result).toBe(false);

    data.setState({ data: panelData(LoadingState.Loading, 3) });

    expect(condition.state.result).toBe(false);
  });

  it('has no result before the first query completes', async () => {
    const { data, condition, group } = await buildScene(panelData(LoadingState.Loading, 0));

    // Nothing has completed yet, so the rule must not invent a result.
    expect(condition.state.result).toBeUndefined();
    expect(group.state.result).toBe(true);

    data.setState({ data: panelData(LoadingState.Done, 3) });

    expect(condition.state.result).toBe(true);
  });

  it('picks up a genuinely new result once the loading query completes', async () => {
    const { data, condition, group } = await buildScene(panelData(LoadingState.Done, 3));

    expect(condition.state.result).toBe(true);

    data.setState({ data: panelData(LoadingState.Loading, 3) });
    expect(condition.state.result).toBe(true);

    // The refreshed query now returns nothing - the held result must not stick.
    data.setState({ data: panelData(LoadingState.Done, 0) });

    expect(condition.state.result).toBe(false);
    expect(group.state.result).toBe(false);
  });
});
