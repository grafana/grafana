import { ReplaySubject } from 'rxjs';

import { FieldType, getDefaultTimeRange, LoadingState, type PanelData, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  SceneObjectBase,
  VizPanel,
  type SceneDataProvider,
  type SceneDataProviderResult,
  type SceneDataState,
} from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';

import { loadSnapshotData } from './loadSnapshotData';
import { forceActivateFullSceneObjectTree } from './utils';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

/**
 * Minimal data provider that mimics a SceneQueryRunner: activating it only sets Loading. Like a
 * real width-derived query runner, it does not actually run (reach Done) until it is given a
 * container width — which is exactly the gate loadSnapshotData has to release for never-rendered
 * panels. In 'never' mode it stays pending even after that, to exercise the timeout path.
 */
class TestQueryRunner extends SceneObjectBase<SceneDataState> implements SceneDataProvider {
  private _results = new ReplaySubject<SceneDataProviderResult>(1);
  private _completed = false;

  public constructor(private mode: 'complete' | 'never' = 'complete') {
    super({ data: undefined });

    this.addActivationHandler(() => {
      this.setState({ data: buildPanelData(LoadingState.Loading, []) });
    });
  }

  public setContainerWidth(width: number) {
    if (width <= 0 || this.mode === 'never' || this._completed) {
      return;
    }
    this._completed = true;

    // async so waitForPanelData has to subscribe to the results stream rather than read an
    // already-Done state — exercising the real code path.
    setTimeout(() => {
      const data = buildPanelData(LoadingState.Done, [
        toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }] }),
      ]);
      this.setState({ data });
      this._results.next({ data, origin: this });
    }, 0);
  }

  public getResultsStream() {
    return this._results;
  }
}

function buildPanelData(state: LoadingState, series: PanelData['series']): PanelData {
  return { state, series, timeRange: getDefaultTimeRange() };
}

function buildPanel(key: string, provider?: SceneDataProvider): VizPanel {
  return new VizPanel({ key, pluginId: 'timeseries', $data: provider });
}

function tabWith(title: string, panel: VizPanel): TabItem {
  return new TabItem({ title, layout: DefaultGridLayoutManager.fromVizPanels([panel]) });
}

describe('loadSnapshotData', () => {
  it('loads data for a panel in a hidden tab and deactivates it afterwards', async () => {
    const activePanel = buildPanel('panel-active', new TestQueryRunner());
    const hiddenPanel = buildPanel('panel-hidden', new TestQueryRunner());

    const dashboard = new DashboardScene({
      body: new TabsLayoutManager({
        tabs: [tabWith('Active', activePanel), tabWith('Hidden', hiddenPanel)],
      }),
    });

    // Simulate the active tab being rendered: its panel is already activated and, like a rendered
    // panel, has been given a container width so its query has run.
    forceActivateFullSceneObjectTree(activePanel);
    activePanel.state.$data!.setContainerWidth!(500);
    expect(activePanel.isActive).toBe(true);
    expect(hiddenPanel.isActive).toBe(false);

    const result = await loadSnapshotData(dashboard);

    expect(result).toEqual({ loadedPanels: 2, timedOutPanels: 0 });
    expect(hiddenPanel.state.$data!.state.data?.state).toBe(LoadingState.Done);
    // The hidden panel we activated is torn down again; the live active panel is left alone.
    expect(hiddenPanel.isActive).toBe(false);
    expect(activePanel.isActive).toBe(true);
  });

  it('loads data for a panel in a collapsed row', async () => {
    const panel = buildPanel('panel-collapsed', new TestQueryRunner());

    const dashboard = new DashboardScene({
      body: new RowsLayoutManager({
        rows: [
          new RowItem({ title: 'Collapsed', collapse: true, layout: DefaultGridLayoutManager.fromVizPanels([panel]) }),
        ],
      }),
    });

    const result = await loadSnapshotData(dashboard);

    expect(result).toEqual({ loadedPanels: 1, timedOutPanels: 0 });
    expect(panel.state.$data!.state.data?.state).toBe(LoadingState.Done);
    expect(panel.isActive).toBe(false);
  });

  it('reports panels that do not finish loading within the timeout and still deactivates them', async () => {
    const stuckPanel = buildPanel('panel-stuck', new TestQueryRunner('never'));

    const dashboard = new DashboardScene({
      body: new TabsLayoutManager({ tabs: [tabWith('Stuck', stuckPanel)] }),
    });

    const result = await loadSnapshotData(dashboard, { perPanelTimeoutMs: 50, overallTimeoutMs: 200 });

    expect(result).toEqual({ loadedPanels: 1, timedOutPanels: 1 });
    expect(stuckPanel.isActive).toBe(false);
  });

  it('treats panels without a data provider as loaded', async () => {
    const panel = buildPanel('panel-no-data');

    const dashboard = new DashboardScene({
      body: new TabsLayoutManager({ tabs: [tabWith('NoData', panel)] }),
    });

    const result = await loadSnapshotData(dashboard);

    expect(result).toEqual({ loadedPanels: 1, timedOutPanels: 0 });
    expect(panel.isActive).toBe(false);
  });
});
