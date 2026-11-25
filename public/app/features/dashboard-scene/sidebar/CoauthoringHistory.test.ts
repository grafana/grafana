import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { replacePanel } from '../actions/panel/replacePanel';
import { endBatch, startBatch } from '../actions/utils/batch';
import { edit } from '../actions/utils/edit';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

import { CoauthoringQueriesAcceptedEvent } from './events';

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((stop) => stop());
  setTestFlags({});
});

function setup() {
  setTestFlags({ dashboardNewLayouts: true });
  const first = new DashboardGridItem({
    body: new VizPanel({
      key: 'panel-1',
      $data: new SceneQueryRunner({ queries: [{ refId: 'A', expr: 'baseline' }], runQueriesMode: 'manual' }),
    }),
  });
  const second = new DashboardGridItem({ body: new VizPanel({ key: 'panel-2' }) });
  const scene = new DashboardScene({
    isEditing: true,
    editable: true,
    uid: 'local-history',
    $timeRange: new SceneTimeRange({ from: '2026-11-01T00:00:00Z', to: '2026-11-01T01:00:00Z' }),
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [first, second] }) }),
  });
  const sidebar = scene.state.sidebar;
  cleanups.push(sidebar.activate());
  const snapshot = (item: DashboardGridItem, panelId: number) => {
    const original = item.state.body.clone();
    edit({
      source: item,
      meta: { actionId: 'panel.edit' },
      replacesPanelState: [panelId],
      description: `Snapshot ${panelId}`,
      perform: () => {},
      undo: () => item.setState({ body: original }),
    });
  };
  const accept = () => {
    const panel = first.state.body;
    getQueryRunnerFor(panel)?.setState({ queries: [{ refId: 'A', expr: 'accepted' }] });
    panel.publishEvent(new CoauthoringQueriesAcceptedEvent({ panelId: 1 }), true);
  };
  return { scene, sidebar, first, second, snapshot, accept };
}

describe('coauthoring accepted panel snapshot ownership', () => {
  it('drops only affected panel snapshots while preserving unrelated standalone Undo', () => {
    const f = setup();
    edit({
      source: f.scene,
      meta: { actionId: 'dashboard.changeDescription' },
      description: 'Unrelated',
      perform: () => f.scene.setState({ description: 'changed' }),
      undo: () => f.scene.setState({ description: 'original' }),
    });
    f.snapshot(f.second, 2);
    f.snapshot(f.first, 1);
    f.accept();
    expect(f.sidebar.state.undoStack.map((action) => action.description)).toEqual(['Unrelated', 'Snapshot 2']);
    f.sidebar.undoLastAction();
    f.sidebar.undoLastAction();
    expect(f.scene.state.description).toBe('original');
    expect(getQueryRunnerFor(f.first.state.body)?.state.queries).toEqual([{ refId: 'A', expr: 'accepted' }]);
  });

  it.each(['completed', 'open', 'nested-open', 'nested-completed'] as const)(
    'invalidates the whole %s batch containing an affected snapshot',
    (mode) => {
      const f = setup();
      startBatch(f.scene, 'Snapshot batch', { actionId: 'test.batch' });
      if (mode.startsWith('nested')) {
        startBatch(f.scene, 'Inner', { actionId: 'test.batch' });
      }
      f.snapshot(f.first, 1);
      if (mode === 'nested-completed') {
        endBatch(f.scene);
      }
      if (mode === 'completed' || mode === 'nested-completed') {
        endBatch(f.scene);
      }
      f.accept();
      if (mode === 'open' || mode === 'nested-open') {
        endBatch(f.scene);
      }
      if (mode === 'nested-open') {
        endBatch(f.scene);
      }
      expect(f.sidebar.state.undoStack.map((action) => action.description)).toEqual([]);
      f.sidebar.undoLastAction();
      expect(getQueryRunnerFor(f.first.state.body)?.state.queries).toEqual([{ refId: 'A', expr: 'accepted' }]);
    }
  );

  it('preserves an open batch for a different panel', () => {
    const f = setup();
    startBatch(f.scene, 'Other panel', { actionId: 'test.batch' });
    f.snapshot(f.second, 2);
    f.accept();
    endBatch(f.scene);
    expect(f.sidebar.state.undoStack.map((action) => action.description)).toEqual(['Other panel']);
    f.sidebar.undoLastAction();
    expect(getQueryRunnerFor(f.first.state.body)?.state.queries).toEqual([{ refId: 'A', expr: 'accepted' }]);
  });
});

describe('coauthoring successful Accept redo ownership', () => {
  it('clears a stale panel replacement redo without a full-scene snapshot', () => {
    const f = setup();
    replacePanel({ source: f.first, oldPanel: f.first.state.body, newPanel: new VizPanel({ title: 'replacement' }) });
    f.sidebar.undoLastAction();
    expect(f.sidebar.state.redoStack.map((action) => action.meta.actionId)).toEqual(['panel.replace']);
    f.accept();
    expect(f.sidebar.state.redoStack.map((action) => action.meta.actionId)).toEqual([]);
    f.sidebar.redoLastAction();
    expect(getQueryRunnerFor(f.first.state.body)?.state.queries).toEqual([{ refId: 'A', expr: 'accepted' }]);
  });
});
