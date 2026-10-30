import { createMemoryHistory } from 'history';
import { BehaviorSubject } from 'rxjs';
import { act, render, screen } from 'test/test-utils';

import { CoreApp, type Scope, dateTime } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import {
  config,
  HistoryWrapper,
  locationService,
  onInteraction,
  ScopesContext,
  type ScopesContextValue,
  setEchoSrv,
  setLocationService,
  setPluginImportUtils,
} from '@grafana/runtime';
import {
  sceneGraph,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  ScopesVariable,
  VizPanel,
} from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { defaultVisualizationPanelKind } from 'app/features/notebook/types';

import { NOTEBOOK_EDIT_SESSION_SOURCE } from '../analytics/types';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';

import { NotebookScene } from './NotebookScene';
import { NotebookSceneUrlSync } from './NotebookSceneUrlSync';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

// Rendering a cell activates its VizPanel, which loads its plugin.
setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

// See CodeCell.test.tsx — the real editor does not run in jsdom, and is a lazily loaded chunk that
// would otherwise resolve outside of this file's act() calls.
jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: ({
    value,
    readOnly,
    onChange,
    'aria-label': ariaLabel,
  }: {
    value: string;
    readOnly?: boolean;
    onChange: (value: string) => void;
    'aria-label'?: string;
  }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
  ),
}));

function buildScene(uid?: string) {
  return new NotebookScene({
    title: 'My notebook',
    uid,
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'md1',
          source: 'assistant',
          content: { kind: 'Markdown', spec: { text: 'Hello' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({ refresh: '10s', intervals: ['10s', '1m'] }),
  });
}

function buildSceneWithPanel() {
  const panel = new VizPanel({ key: 'panel-4', title: 'Checkout latency', pluginId: 'timeseries' });
  const scene = new NotebookScene({
    title: 'My notebook',
    body: new NotebookLayoutManager({
      cells: [new NotebookCellItem({ elementName: 'latency', source: 'user', body: panel })],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });

  return { scene, panel };
}

// activate() registers the scene on window.__grafanaSceneContext; leaving it registered leaks into
// later tests in this file.
const deactivators: Array<() => void> = [];
function activate(scene: NotebookScene) {
  deactivators.push(scene.activate());
}

describe('NotebookScene', () => {
  afterEach(() => {
    deactivators.splice(0).forEach((deactivate) => deactivate());
  });

  it('activates the refresh picker itself, whether or not a surface renders the controls', () => {
    const scene = buildScene();

    const deactivate = scene.activate();

    expect(scene.state.refreshPicker.isActive).toBe(true);

    deactivate();
    expect(scene.state.refreshPicker.isActive).toBe(false);
  });

  it('renders the document only, with no controls row', () => {
    const scene = buildScene();
    activate(scene);

    render(<scene.Component model={scene} />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Time range selected/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh time interval/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  describe('edit mode', () => {
    const originalLocationService = locationService;

    beforeEach(() => {
      // A memory history keeps the url assertions independent of whatever jsdom's location is.
      setLocationService(new HistoryWrapper(createMemoryHistory({ initialEntries: ['/notebooks/nb1'] })));
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    });

    afterEach(() => {
      setLocationService(originalLocationService);
      jest.restoreAllMocks();
    });

    it('starts in view mode', () => {
      expect(buildScene().state.isEditing).toBeUndefined();
    });

    it('enters edit mode and tells the layout', () => {
      const scene = buildScene();

      scene.onEnterEditMode();

      expect(scene.state.isEditing).toBe(true);
      // Asserted through the layout's own state rather than a spy, so the propagation is real.
      expect(scene.state.body.state.isEditing).toBe(true);
    });

    // Reflecting the mode in the url is NotebookSceneUrlSync's job, not these methods' — covered by
    // its own tests and by the page test that mounts the sync provider.
    it('refuses a user without edit permission, whatever the caller', () => {
      // NotebookSceneUrlSync calls this directly, so the guard cannot live only in the toggle.
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      const scene = buildScene();

      scene.onEnterEditMode();

      expect(scene.state.isEditing).toBeUndefined();
      expect(scene.state.body.state.isEditing).toBeUndefined();
    });

    it('leaves edit mode again, clearing the layout too', () => {
      const scene = buildScene();
      scene.onEnterEditMode();

      scene.onExitEditMode();

      expect(scene.state.isEditing).toBe(false);
      expect(scene.state.body.state.isEditing).toBe(false);
    });

    it('commits an active content edit before leaving edit mode', () => {
      const scene = buildScene();
      const cell = scene.state.body.state.cells[0];
      scene.onEnterEditMode();
      scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'Updated' } });

      scene.onExitEditMode();
      scene.editHistory.undo();

      expect(cell.state.content).toEqual({ kind: 'Markdown', spec: { text: 'Hello' } });
    });

    it('commits an active query edit before leaving edit mode, so a later edit is a separate undo step', () => {
      const panel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 1));
      const runner = getQueryRunnerFor(panel)!;
      const before = runner.state.queries;
      const midway = [{ ...before[0], expr: 'up' } as DataQuery];
      const after = [{ ...before[0], expr: 'up | limit 10' } as DataQuery];
      const cell = new NotebookCellItem({ elementName: 'query1', source: 'user', body: panel });
      const scene = new NotebookScene({
        title: 'My notebook',
        body: new NotebookLayoutManager({ cells: [cell] }),
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        timePicker: new SceneTimePicker({}),
        refreshPicker: new SceneRefreshPicker({}),
      });
      scene.onEnterEditMode();
      scene.state.body.setCellQueries(cell, midway);

      scene.onExitEditMode();
      scene.onEnterEditMode();
      scene.state.body.setCellQueries(cell, after);

      scene.editHistory.undo();
      expect(runner.state.queries).toEqual(midway);

      scene.editHistory.undo();
      expect(runner.state.queries).toEqual(before);
    });

    describe('edit session analytics', () => {
      let started: Array<Record<string, unknown>>;
      let unsubscribe: () => void;

      beforeEach(() => {
        setEchoSrv(new Echo());
        started = [];
        unsubscribe = onInteraction('grafana_notebook_edit_session_started', (properties) => started.push(properties));
      });

      afterEach(() => {
        unsubscribe();
      });

      it('reports a toggle when the Edit control turns edit mode on', () => {
        const scene = buildScene('nb1');

        scene.onEnterEditMode();

        expect(started).toEqual([{ notebookUid: 'nb1', source: 'toggle', schema_version: 1 }]);
      });

      it('reports a navigation when the url brought the reader into edit mode', () => {
        const scene = buildScene('nb1');

        scene.onEnterEditMode(NOTEBOOK_EDIT_SESSION_SOURCE.NAVIGATION);

        expect(started).toEqual([{ notebookUid: 'nb1', source: 'navigation', schema_version: 1 }]);
      });

      // The blank route opens in edit mode before autosave creates the notebook, so there is no uid yet.
      it('reports a new notebook while it has no uid, whichever control opened it', () => {
        const scene = buildScene();

        scene.onEnterEditMode();

        expect(started).toEqual([{ notebookUid: '', source: 'new', schema_version: 1 }]);
      });

      it('reports one session when edit mode is entered again while already editing', () => {
        const scene = buildScene('nb1');

        scene.onEnterEditMode();
        scene.onEnterEditMode();

        expect(started).toEqual([{ notebookUid: 'nb1', source: 'toggle', schema_version: 1 }]);
      });

      it('counts nothing from the previous session when edit mode is entered again', () => {
        const scene = buildScene('nb1');
        const cell = scene.state.body.state.cells[0];
        scene.onEnterEditMode();
        scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'Updated' } });
        scene.onExitEditMode();

        scene.onEnterEditMode();

        expect(scene.editSession.end().editCount).toBe(0);
      });
    });

    describe('edit session ended', () => {
      let ended: Array<Record<string, unknown>>;
      let unsubscribe: () => void;

      beforeEach(() => {
        setEchoSrv(new Echo());
        ended = [];
        unsubscribe = onInteraction('grafana_notebook_edit_session_ended', (properties) => ended.push(properties));
      });

      afterEach(() => {
        unsubscribe();
      });

      it('reports the session totals and the notebook shape when the toggle turns edit mode off', () => {
        const scene = buildScene('nb1');
        const cell = scene.state.body.state.cells[0];
        scene.onEnterEditMode();
        scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'Updated' } });

        scene.onExitEditMode();

        expect(ended).toHaveLength(1);
        expect(ended[0]).toMatchObject({
          notebookUid: 'nb1',
          editCount: 1,
          endReason: 'toggle',
          cellCount: 1,
          nonEmptyCellCount: 1,
        });
        expect(typeof ended[0].durationMs).toBe('number');
      });

      it('reports what the session did to the cells', () => {
        const scene = buildScene('nb1');
        const body = scene.state.body;
        scene.onEnterEditMode();

        body.addCell('code', 1);
        body.addCell('paragraph', 2);
        body.removeCell(body.state.cells[0]);
        body.moveCell(0, 1);

        scene.onExitEditMode();

        expect(ended[0]).toMatchObject({ cellsAdded: 2, cellsRemoved: 1, cellsMoved: 1 });
      });

      it('reports a time range moved during the session', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();

        scene.state.$timeRange.onTimeRangeChange({
          from: dateTime('2026-09-01T00:00:00Z'),
          to: dateTime('2026-09-02T00:00:00Z'),
          raw: { from: 'now-24h', to: 'now' },
        });
        scene.onExitEditMode();
        deactivate();

        expect(ended[0]).toMatchObject({ timeRangeChanged: true });
      });

      // The time picker belongs to whoever is reading, and the notebook does not keep what they set.
      // Between two sessions is where this matters: `start()` clears the flag on the way in, so only
      // the isEditing guard stops a reader's change landing on the session that comes after it.
      it('does not report a time range a reader moved between two sessions', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();
        scene.onExitEditMode();

        scene.state.$timeRange.onTimeRangeChange({
          from: dateTime('2026-09-01T00:00:00Z'),
          to: dateTime('2026-09-02T00:00:00Z'),
          raw: { from: 'now-24h', to: 'now' },
        });

        scene.onEnterEditMode();
        scene.onExitEditMode();
        deactivate();

        expect(ended).toHaveLength(2);
        expect(ended[1]).toMatchObject({ timeRangeChanged: false });
      });

      it('does not fire when the notebook was already in view mode', () => {
        const scene = buildScene('nb1');

        scene.onExitEditMode();

        expect(ended).toEqual([]);
      });

      it('reports a navigation end reason when the notebook deactivates mid-edit', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();

        deactivate();

        expect(ended).toEqual([expect.objectContaining({ notebookUid: 'nb1', endReason: 'navigation' })]);
      });

      // Typing is one coalescing undo step that stays open until it is committed, and only
      // onExitEditMode commits it. Leaving the page mid-word has to count that typing anyway.
      it('counts typing that was still open when the notebook deactivated', () => {
        const scene = buildScene('nb1');
        const cell = scene.state.body.state.cells[0];
        const deactivate = scene.activate();
        scene.onEnterEditMode();
        scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'Half a sen' } });

        deactivate();

        expect(ended).toEqual([expect.objectContaining({ endReason: 'navigation', editCount: 1 })]);
      });

      // The page keeps its scenes in a module-level cache, so this same scene comes back on the next
      // visit. A scene left mid-session reported a second end for a visit that only read it.
      it('leaves edit mode with the session, so reopening to read reports nothing more', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();

        deactivate();
        // What the page does when it hands the cached scene back.
        scene.resetStaleEditMode();
        // Reopened by its title, so the url carries no edit param.
        new NotebookSceneUrlSync(scene).updateFromUrl({ edit: null });

        expect(ended).toEqual([expect.objectContaining({ endReason: 'navigation' })]);
      });

      it('reports a fresh session when a cached notebook is reopened in edit mode', () => {
        const started: Array<Record<string, unknown>> = [];
        const unsubscribeStarted = onInteraction('grafana_notebook_edit_session_started', (properties) =>
          started.push(properties)
        );
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();
        deactivate();
        scene.resetStaleEditMode();
        started.length = 0;

        // The list's Edit action again, on a scene the previous visit left behind.
        new NotebookSceneUrlSync(scene).updateFromUrl({ edit: 'true' });
        unsubscribeStarted();

        expect(started).toEqual([{ notebookUid: 'nb1', source: 'navigation', schema_version: 1 }]);
        expect(scene.state.isEditing).toBe(true);
      });

      // The url sync is still listening when the scene deactivates, so turning isEditing off there
      // rewrites the url and drops ?edit=true. StrictMode remounts the page this way in development.
      it('does not change edit mode on deactivation, so the url keeps its edit param', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();
        const changes: boolean[] = [];
        scene.subscribeToState((state) => changes.push(Boolean(state.isEditing)));

        deactivate();

        expect(changes).toEqual([]);
        expect(scene.state.isEditing).toBe(true);
      });

      it('starts a new session when reactivated still editing, as StrictMode does', () => {
        const started: Array<Record<string, unknown>> = [];
        const unsubscribeStarted = onInteraction('grafana_notebook_edit_session_started', (properties) =>
          started.push(properties)
        );
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();
        deactivate();
        started.length = 0;

        deactivators.push(scene.activate());
        unsubscribeStarted();

        expect(ended).toHaveLength(1);
        expect(started).toEqual([{ notebookUid: 'nb1', source: 'page_restore', schema_version: 1 }]);
      });

      it('does not reset edit mode on a scene another consumer still has active', () => {
        const scene = buildScene('nb1');
        deactivators.push(scene.activate());
        scene.onEnterEditMode();

        scene.resetStaleEditMode();

        expect(scene.state.isEditing).toBe(true);
      });

      it('does not fire on deactivation when the notebook was never editing', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();

        deactivate();

        expect(ended).toEqual([]);
      });

      // A reload or a closed tab tears nothing down inside the app, so only the page itself says so.
      it('reports a page hide while a session is still open', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();

        window.dispatchEvent(new Event('pagehide'));
        deactivate();

        // Once: `pagehide` leaves edit mode on, so the teardown that follows must not end it again.
        expect(ended).toHaveLength(1);
        expect(ended[0]).toMatchObject({ endReason: 'page_hide' });
      });

      it('does not report a second end when the toggle is turned off after a page hide', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();

        window.dispatchEvent(new Event('pagehide'));
        scene.onExitEditMode();
        deactivate();

        expect(ended).toHaveLength(1);
        expect(ended[0]).toMatchObject({ endReason: 'page_hide' });
      });

      describe('when the browser brings the page back from the back/forward cache', () => {
        const pageshow = (persisted: boolean) => Object.assign(new Event('pageshow'), { persisted });
        let timeline: string[];
        let stopStarted: () => void;
        let stopEnded: () => void;

        beforeEach(() => {
          timeline = [];
          stopStarted = onInteraction('grafana_notebook_edit_session_started', (properties) =>
            timeline.push(`started:${properties.source}`)
          );
          stopEnded = onInteraction('grafana_notebook_edit_session_ended', (properties) =>
            timeline.push(`ended:${properties.endReason}`)
          );
        });

        afterEach(() => {
          stopStarted();
          stopEnded();
        });

        it('starts a new session, so every end is paired with a start', () => {
          const scene = buildScene('nb1');
          const deactivate = scene.activate();
          scene.onEnterEditMode();

          window.dispatchEvent(new Event('pagehide'));
          window.dispatchEvent(pageshow(true));
          scene.onExitEditMode();
          deactivate();

          expect(timeline).toEqual(['started:toggle', 'ended:page_hide', 'started:page_restore', 'ended:toggle']);
        });

        it('counts the restored session from the restore, not from before the page was hidden', () => {
          const scene = buildScene('nb1');
          const cell = scene.state.body.state.cells[0];
          const deactivate = scene.activate();
          scene.onEnterEditMode();
          scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'Before' } });

          window.dispatchEvent(new Event('pagehide'));
          window.dispatchEvent(pageshow(true));
          scene.onExitEditMode();
          deactivate();

          expect(ended).toHaveLength(2);
          expect(ended[0]).toMatchObject({ endReason: 'page_hide', editCount: 1 });
          expect(ended[1]).toMatchObject({ endReason: 'toggle', editCount: 0 });
        });

        it('ends a restored session once when the page is torn down instead', () => {
          const scene = buildScene('nb1');
          const deactivate = scene.activate();
          scene.onEnterEditMode();

          window.dispatchEvent(new Event('pagehide'));
          window.dispatchEvent(pageshow(true));
          deactivate();

          expect(timeline).toEqual(['started:toggle', 'ended:page_hide', 'started:page_restore', 'ended:navigation']);
        });

        // An ordinary load fires `pageshow` too, with nothing kept from before.
        it('starts nothing for a pageshow that is not a restore', () => {
          const scene = buildScene('nb1');
          const deactivate = scene.activate();
          scene.onEnterEditMode();
          window.dispatchEvent(new Event('pagehide'));

          window.dispatchEvent(pageshow(false));
          deactivate();

          expect(timeline).toEqual(['started:toggle', 'ended:page_hide']);
        });

        it('starts nothing when the notebook is not being edited', () => {
          const scene = buildScene('nb1');
          const deactivate = scene.activate();

          window.dispatchEvent(pageshow(true));
          deactivate();

          expect(timeline).toEqual([]);
        });

        it('starts nothing once the scene has been deactivated', () => {
          const scene = buildScene('nb1');
          const deactivate = scene.activate();
          scene.onEnterEditMode();
          window.dispatchEvent(new Event('pagehide'));
          deactivate();
          timeline.length = 0;

          window.dispatchEvent(pageshow(true));

          expect(timeline).toEqual([]);
        });

        it('does not start a second session when a restore finds one already running', () => {
          const scene = buildScene('nb1');
          const deactivate = scene.activate();
          scene.onEnterEditMode();

          window.dispatchEvent(pageshow(true));
          deactivate();

          expect(timeline).toEqual(['started:toggle', 'ended:navigation']);
        });
      });

      it('reports nothing on a page hide when the notebook is not being edited', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();

        window.dispatchEvent(new Event('pagehide'));
        deactivate();

        expect(ended).toEqual([]);
      });

      // In-app navigation deactivates the scene, which ends the session itself and turns editing off.
      it('does not report a page hide for a session that navigation already ended', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();

        deactivate();
        window.dispatchEvent(new Event('pagehide'));

        expect(ended).toHaveLength(1);
        expect(ended[0]).toMatchObject({ endReason: 'navigation' });
      });

      it('does not double-fire when a toggle-off is followed by a deactivation', () => {
        const scene = buildScene('nb1');
        const deactivate = scene.activate();
        scene.onEnterEditMode();

        scene.onExitEditMode();
        deactivate();

        expect(ended).toHaveLength(1);
        expect(ended[0]).toMatchObject({ endReason: 'toggle' });
      });
    });

    // A different notebook is never the same scene instance swapping its body under itself — it's a
    // distinct NotebookScene, built fresh by transformNotebookToScene, with its own editHistory that
    // was never going to know about the first one's stack in the first place.
    it('gives a different notebook scene its own independent edit history', () => {
      const first = buildScene('nb1');
      activate(first);
      first.state.body.addCell('code', 1);
      expect(first.editHistory.state.canUndo).toBe(true);

      const second = buildScene('nb2');
      activate(second);

      expect(second.editHistory.state.canUndo).toBe(false);
    });

    it('keeps history across a deactivation and activation', () => {
      const scene = buildScene();
      const deactivate = scene.activate();
      scene.state.body.addCell('code', 1);

      deactivate();
      activate(scene);

      expect(scene.editHistory.state.canUndo).toBe(true);
      scene.editHistory.undo();
      expect(scene.state.body.state.cells).toHaveLength(1);
    });
  });

  describe('getDashboardPanels', () => {
    it('returns the panels of the panel cells', () => {
      const { scene, panel } = buildSceneWithPanel();

      expect(scene.getDashboardPanels()).toEqual([panel]);
    });
  });

  describe('enrichDataRequest', () => {
    // Notebook queries have to be attributable. CoreApp.Unknown cannot be told apart from a
    // genuinely unattributed query, and CoreApp.Dashboard is a behavioural branch (SqlDatasource
    // skips grafana_sql_query_executed for it), not just a label.
    it('attributes queries to the notebook app', () => {
      const { scene, panel } = buildSceneWithPanel();

      expect(scene.enrichDataRequest(panel).app).toBe(CoreApp.Notebook);
    });

    // Root-agnostic: getClosestVizPanel/getPanelIdForVizPanel only walk parents, so there is no
    // reason for a notebook to drop the per-panel attribution a dashboard sends. panelId in
    // particular feeds per-panel query caching.
    it('carries the panel identity', () => {
      const { scene, panel } = buildSceneWithPanel();

      expect(scene.enrichDataRequest(panel)).toMatchObject({
        panelId: 4,
        panelName: 'Checkout latency',
        panelPluginId: 'timeseries',
      });
    });

    // dashboardUID is deliberately absent — a notebook is not a dashboard, and sending its uid
    // there would misattribute the query in datasource-side telemetry.
    it('does not send a dashboardUID', () => {
      const { scene, panel } = buildSceneWithPanel();

      expect(scene.enrichDataRequest(panel)).not.toHaveProperty('dashboardUID');
    });
  });

  describe('scopes', () => {
    const scope: Scope = {
      metadata: { name: 'cluster-1' },
      spec: { title: 'Cluster 1', filters: [{ key: 'cluster', value: 'cluster-1', operator: 'equals' }] },
    };

    afterEach(() => {
      config.featureToggles.scopeFilters = false;
    });

    function buildScopesContext(value: Scope[]): ScopesContextValue {
      const state = { drawerOpened: false, enabled: false, loading: false, value };
      const stateObservable = new BehaviorSubject(state);

      return {
        get state() {
          return stateObservable.getValue();
        },
        stateObservable,
        changeScopes: jest.fn(),
        setEnabled: jest.fn((enabled: boolean) => stateObservable.next({ ...stateObservable.getValue(), enabled })),
      };
    }

    it('has no scopes variable when scopeFilters is off', () => {
      config.featureToggles.scopeFilters = false;

      expect(buildScene().state.$variables).toBeUndefined();
    });

    it('adds the scopes variable when scopeFilters is on', () => {
      config.featureToggles.scopeFilters = true;

      const variables = buildScene().state.$variables?.state.variables;

      expect(variables).toHaveLength(1);
      expect(variables?.[0]).toBeInstanceOf(ScopesVariable);
    });

    // The whole point: SceneQueryRunner reads scopes off the graph via lookupVariable('__scopes'),
    // so this resolving is what makes a notebook cell's query carry the selected scopes.
    it('resolves the selected scopes for a panel in a cell', async () => {
      config.featureToggles.scopeFilters = true;
      const { scene, panel } = buildSceneWithPanel();

      activate(scene);
      // act: rendering the cell activates its VizPanel, which loads its plugin asynchronously.
      await act(async () => {
        render(
          <ScopesContext.Provider value={buildScopesContext([scope])}>
            <scene.Component model={scene} />
          </ScopesContext.Provider>
        );
      });

      expect(sceneGraph.getScopes(panel)).toEqual([scope]);
    });

    // ScopesVariable starts with `loading: true` and only clears it once its renderer has handed it
    // the context. If the renderer stops mounting hidden variables, every query runner that depends
    // on it (SceneQueryRunner sets dependsOnScopes) waits forever and no cell ever loads. This
    // asserts the variable is settled, which is the condition query runners actually wait on.
    it('settles the scopes variable so query runners are not blocked', () => {
      config.featureToggles.scopeFilters = true;
      const scene = buildScene();
      const variable = scene.state.$variables!.state.variables[0];

      activate(scene);
      expect(variable.state.loading).toBe(true);

      render(
        <ScopesContext.Provider value={buildScopesContext([scope])}>
          <scene.Component model={scene} />
        </ScopesContext.Provider>
      );

      expect(variable.state.loading).toBe(false);
      expect(sceneGraph.hasVariableDependencyInLoadingState(scene.state.body.state.cells[0])).toBe(false);
    });

    // The variable is also what turns the selector on, so a notebook page has to enable scopes the
    // same way a dashboard does rather than inheriting whatever the previous route left behind.
    it('enables scopes while the notebook is mounted', () => {
      config.featureToggles.scopeFilters = true;
      const scene = buildScene();
      const context = buildScopesContext([scope]);

      activate(scene);
      render(
        <ScopesContext.Provider value={context}>
          <scene.Component model={scene} />
        </ScopesContext.Provider>
      );

      expect(context.setEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('tags', () => {
    it('is the single writer, and refreshes the copy the header renders', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() => scene.onTagsChange(['latency', 'slo']));

      // Both, deliberately: the scene's copy is what the save model reads, the layout manager's is
      // what the document header renders, and the whole point of pushing is that they cannot drift.
      expect(scene.state.tags).toEqual(['latency', 'slo']);
      expect(scene.state.body.state.tags).toEqual(['latency', 'slo']);
    });

    it('reaches the save model, so an export or a future save sees the edit', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() => scene.onTagsChange(['incident']));

      expect(transformNotebookSceneToSaveModel(scene).tags).toEqual(['incident']);
    });

    // The mirror is pushed from a state subscription rather than from onTagsChange, so a whole-state
    // swap (what APPLY_NOTEBOOK_SPEC does) reaches the header too.
    it('survives the body being replaced wholesale', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() =>
        scene.setState({
          tags: ['rebuilt'],
          body: new NotebookLayoutManager({ cells: [] }),
        })
      );

      expect(scene.state.body.state.tags).toEqual(['rebuilt']);
    });

    it('records a tag change so it can be undone', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() => scene.onTagsChange(['latency']));

      expect(scene.editHistory.state.canUndo).toBe(true);
      expect(scene.editHistory.state.undoLabel).toBe('Add tag');

      act(() => scene.editHistory.undo());

      expect(scene.state.tags).toEqual([]);
      expect(scene.state.body.state.tags).toEqual([]);
    });

    it('labels removing a tag distinctly, and supports redo', () => {
      const scene = buildScene();
      act(() => scene.activate());
      act(() => scene.onTagsChange(['latency', 'slo']));

      act(() => scene.onTagsChange(['latency']));

      expect(scene.editHistory.state.undoLabel).toBe('Remove tag');

      act(() => scene.editHistory.undo());
      expect(scene.state.tags).toEqual(['latency', 'slo']);

      act(() => scene.editHistory.redo());
      expect(scene.state.tags).toEqual(['latency']);
    });

    it('does not record a no-op tag change', () => {
      const scene = buildScene();
      act(() => scene.activate());
      act(() => scene.onTagsChange(['latency']));

      act(() => scene.onTagsChange(['latency']));

      expect(scene.editHistory.state.canUndo).toBe(true);
      // A single undo should clear the one real change, not a second no-op entry.
      act(() => scene.editHistory.undo());
      expect(scene.state.tags).toEqual([]);
      expect(scene.editHistory.state.canUndo).toBe(false);
    });

    it('commits an active content edit first, so it lands as its own undo step under the tag change', () => {
      const scene = buildScene();
      const cell = scene.state.body.state.cells[0];
      act(() => scene.activate());
      act(() => scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'Updated' } }));

      act(() => scene.onTagsChange(['latency']));

      act(() => scene.editHistory.undo());
      expect(scene.state.tags).toEqual([]);

      act(() => scene.editHistory.undo());
      expect(cell.state.content).toEqual({ kind: 'Markdown', spec: { text: 'Hello' } });
    });
  });

  describe('title', () => {
    it('is the single writer, and refreshes the copy the header renders', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() => scene.onTitleChange('Q3 latency regression'));

      // Both, for the same reason as tags: the scene's copy is what the save model reads, the layout
      // manager's is what the header renders, and pushing is what stops the two drifting.
      expect(scene.state.title).toBe('Q3 latency regression');
      expect(scene.state.body.state.title).toBe('Q3 latency regression');
    });

    it('reaches the save model, so autosave writes the rename', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() => scene.onTitleChange('Q3 latency regression'));

      expect(transformNotebookSceneToSaveModel(scene).title).toBe('Q3 latency regression');
    });

    // Pushed from the state subscription rather than from onTitleChange, so an APPLY_NOTEBOOK_SPEC
    // swap reaches the header too.
    it('survives the body being replaced wholesale', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() =>
        scene.setState({
          title: 'Rebuilt',
          body: new NotebookLayoutManager({ cells: [] }),
        })
      );

      expect(scene.state.body.state.title).toBe('Rebuilt');
    });

    it('records a title change so it can be undone', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() => scene.onTitleChange('Q3 latency regression'));

      expect(scene.editHistory.state.canUndo).toBe(true);
      expect(scene.editHistory.state.undoLabel).toBe('Rename notebook');

      act(() => scene.editHistory.undo());

      expect(scene.state.title).toBe('My notebook');
      expect(scene.state.body.state.title).toBe('My notebook');
    });

    it('coalesces rapid title changes into one undo action', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() => scene.onTitleChange('Q'));
      act(() => scene.onTitleChange('Q3'));
      act(() => scene.onTitleChange('Q3 latency regression'));

      expect(scene.editHistory.state.canUndo).toBe(true);
      expect(scene.editHistory.state.undoLabel).toBe('Rename notebook');

      act(() => scene.editHistory.undo());

      // One undo reverts the whole rename, not just the last keystroke.
      expect(scene.state.title).toBe('My notebook');
      expect(scene.editHistory.state.canUndo).toBe(false);
    });

    it('drops a title edit that returns to its starting value', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() => scene.onTitleChange('Q3 latency regression'));
      act(() => scene.onTitleChange('My notebook'));

      expect(scene.editHistory.state.canUndo).toBe(false);
    });

    it('starts a new undo step after the coalescing window', () => {
      jest.useFakeTimers();
      try {
        const scene = buildScene();
        act(() => scene.activate());

        act(() => scene.onTitleChange('Q3 latency regression'));
        act(() => jest.advanceTimersByTime(801));
        act(() => scene.onTitleChange('Q4 latency regression'));

        act(() => scene.editHistory.undo());
        expect(scene.state.title).toBe('Q3 latency regression');

        act(() => scene.editHistory.undo());
        expect(scene.state.title).toBe('My notebook');
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not record a no-op title change', () => {
      const scene = buildScene();
      act(() => scene.activate());
      act(() => scene.onTitleChange('Q3 latency regression'));

      act(() => scene.onTitleChange('Q3 latency regression'));

      expect(scene.editHistory.state.canUndo).toBe(true);
      // A single undo should clear the one real change, not a second no-op entry.
      act(() => scene.editHistory.undo());
      expect(scene.state.title).toBe('My notebook');
      expect(scene.editHistory.state.canUndo).toBe(false);
    });

    it('commits an active content edit first, so it lands as its own undo step under the title change', () => {
      const scene = buildScene();
      const cell = scene.state.body.state.cells[0];
      act(() => scene.activate());
      act(() => scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'Updated' } }));

      act(() => scene.onTitleChange('Q3 latency regression'));

      act(() => scene.editHistory.undo());
      expect(scene.state.title).toBe('My notebook');

      act(() => scene.editHistory.undo());
      expect(cell.state.content).toEqual({ kind: 'Markdown', spec: { text: 'Hello' } });
    });

    it('starts a fresh pending edit after a tag change, instead of extending the buried one', () => {
      const scene = buildScene();
      act(() => scene.activate());

      act(() => scene.onTitleChange('Q3 latency regression'));
      act(() => scene.onTagsChange(['incident']));
      // Without the commit above, this would extend the buried rename and silently discard it instead
      // of recording a new step, since editHistory.discard only acts on the top of the stack.
      act(() => scene.onTitleChange('My notebook'));

      expect(scene.editHistory.state.undoLabel).toBe('Rename notebook');

      act(() => scene.editHistory.undo());
      expect(scene.state.title).toBe('Q3 latency regression');

      act(() => scene.editHistory.undo());
      expect(scene.state.tags).toEqual([]);
      expect(scene.state.title).toBe('Q3 latency regression');

      act(() => scene.editHistory.undo());
      expect(scene.state.title).toBe('My notebook');
      expect(scene.editHistory.state.canUndo).toBe(false);
    });

    it('commits a pending title edit before leaving edit mode', () => {
      const scene = buildScene();
      act(() => scene.activate());
      act(() => scene.onEnterEditMode());

      act(() => scene.onTitleChange('Q3 latency regression'));
      act(() => scene.onExitEditMode());
      act(() => scene.onEnterEditMode());
      act(() => scene.onTitleChange('Q4 latency regression'));

      // Two renames, not one coalesced step: the first was sealed by onExitEditMode.
      act(() => scene.editHistory.undo());
      expect(scene.state.title).toBe('Q3 latency regression');
      act(() => scene.editHistory.undo());
      expect(scene.state.title).toBe('My notebook');
      expect(scene.editHistory.state.canUndo).toBe(false);
    });

    it('commits a pending title edit on deactivation', () => {
      const scene = buildScene();
      const deactivate = scene.activate();

      act(() => scene.onTitleChange('Q3 latency regression'));
      act(() => deactivate());
      act(() => scene.activate());
      act(() => scene.onTitleChange('Q4 latency regression'));

      // Two renames, not one coalesced step: the first was sealed on deactivation.
      act(() => scene.editHistory.undo());
      expect(scene.state.title).toBe('Q3 latency regression');
      act(() => scene.editHistory.undo());
      expect(scene.state.title).toBe('My notebook');
      expect(scene.editHistory.state.canUndo).toBe(false);
    });
  });
});
