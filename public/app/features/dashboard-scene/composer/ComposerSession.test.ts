import { act } from '@testing-library/react';

import { locationService, reportInteraction } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import {
  getEffectiveExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { KeybindingSet } from 'app/core/services/KeybindingSet';
import { setDashboardMutationClientForTests } from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationApi';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import { DashboardMutationClient } from '../mutation-api/DashboardMutationClient';
import { type DashboardScene } from '../scene/DashboardScene';
import { canManuallyEditDashboard, getDashboardMode } from '../scene/dashboardModes';
import { isFullDashboardEditing } from '../scene/types/dashboard';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { getDashboardResourceText } from '../sidebar/codePaneUtils';
import { DashboardInteractions } from '../utils/interactions';

import { ComposerSession } from './ComposerSession';
import { canEnterComposer } from './composerAccess';

// The Assistant's sidebar: the plugin that may float.
const sidebarPresentation = () => getEffectiveExtensionSidebarPresentation('grafana-assistant-app');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  // Ad hoc variables look their data source up after the scene is built (#133913).
  getDataSourceInstanceSettings: jest.fn().mockResolvedValue({ meta: { multiValueFilterOperators: true } }),
}));

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

const COMPOSER_FLAGS = {
  dashboardNewLayouts: true,
  'grafana.dashboardPreviewMode': true,
  'grafana.dashboardComposer': true,
};

let deactivate = () => {};

beforeEach(() => {
  setTestFlags(COMPOSER_FLAGS);
  locationService.replace('/d/composer-test');
});

afterEach(() => {
  resetExtensionSidebarPresentationForTests();
  deactivate();
  deactivate = () => {};
  setTestFlags({});
});

function setup() {
  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'Original title',
      uid: 'composer-test',
      version: 1,
      schemaVersion: 39,
      panels: [
        {
          id: 1,
          type: 'text',
          title: 'Notes',
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          options: { mode: 'markdown', content: 'Keep this text' },
          fieldConfig: { defaults: {}, overrides: [] },
        },
      ],
      annotations: {
        list: [
          {
            builtIn: 1,
            iconColor: 'rgba(0, 211, 255, 1)',
            enable: false,
            hide: true,
            name: 'Annotations & Alerts',
            type: 'dashboard',
            datasource: { uid: '-- Grafana --', type: 'grafana' },
          },
        ],
      },
    },
    meta: { canEdit: true, canSave: true },
  });
  deactivate = scene.activate();
  return scene;
}

function enter(scene: DashboardScene) {
  return ComposerSession.enter(scene);
}

async function retitled(session: ComposerSession, title: string) {
  const { spec, revision } = await session.readSpec();
  return { spec: { ...spec, title }, revision };
}

const live = () => new AbortController().signal;

describe('entering and leaving Composer', () => {
  it('hides manual editing over the underlying edit session', () => {
    const scene = setup();
    expect(canEnterComposer(scene)).toEqual({ ok: true });

    const session = enter(scene);

    expect(getDashboardMode(scene.state)).toBe('composer');
    expect(scene.state.isEditing).toBe(true);
    expect(isFullDashboardEditing(scene.state)).toBe(false);
    expect(canManuallyEditDashboard(scene.state)).toBe(false);
    expect(scene.prepareEditAction()).toBe(false);
    expect(scene.getComposerSession()).toBe(session);
    expect(session.target).toEqual({ resource: 'dashboard', uid: 'composer-test' });
    expect(session).not.toHaveProperty('dashboardUid');
    // The session leaves the extension sidebar to whoever entered it.
    expect(sidebarPresentation()).toBe('docked');
    expect(canEnterComposer(scene)).toEqual({ ok: false, reason: 'unsupported' });
  });

  it.each([
    ['the Composer flag is off', { ...COMPOSER_FLAGS, 'grafana.dashboardComposer': false }],
    ['modes are off', { ...COMPOSER_FLAGS, 'grafana.dashboardPreviewMode': false }],
  ])('is unsupported when %s', (_, flags) => {
    const scene = setup();
    setTestFlags(flags);
    expect(canEnterComposer(scene)).toEqual({ ok: false, reason: 'unsupported' });
    expect(() => enter(scene)).toThrow('unsupported');
    expect(getDashboardMode(scene.state)).toBe('view');
  });

  it('requires edit permission and an active dashboard', () => {
    const scene = setup();
    scene.setState({ meta: { canEdit: false, canSave: false } });
    expect(canEnterComposer(scene)).toEqual({ ok: false, reason: 'no_permission' });
    expect(canEnterComposer(null)).toEqual({ ok: false, reason: 'no_document' });
  });

  it('attributes the edit session and period it starts to Assistant', () => {
    const scene = setup();
    const sessionStarted = jest.spyOn(DashboardInteractions, 'editSessionStarted');
    const periodStarted = jest.spyOn(DashboardInteractions, 'editPeriodStarted');
    try {
      enter(scene);
      expect(sessionStarted).toHaveBeenCalledWith(expect.objectContaining({ source: 'assistant' }));
      expect(periodStarted).toHaveBeenCalledWith(expect.objectContaining({ source: 'assistant' }));
      expect(scene.getEditSessionSource()).toBe('assistant');
      expect(scene.getEditSessionTracking()).toMatchObject({ edit_source: 'assistant', mode: 'composer' });
    } finally {
      sessionStarted.mockRestore();
      periodStarted.mockRestore();
    }
  });

  it('turns dashboard keybindings off while active and back on after exit', () => {
    const scene = setup();
    const removeAll = jest.spyOn(KeybindingSet.prototype, 'removeAll');
    const addBinding = jest.spyOn(KeybindingSet.prototype, 'addBinding');
    try {
      const session = enter(scene);
      expect(removeAll).toHaveBeenCalledTimes(1);
      addBinding.mockClear();
      session.exit();
      expect(addBinding).toHaveBeenCalled();
    } finally {
      removeAll.mockRestore();
      addBinding.mockRestore();
    }
  });

  it('refuses to enter Composer through the generic mode switch', () => {
    const scene = setup();
    expect(scene.setDashboardMode('composer', 'restore')).toBe(false);
    expect(getDashboardMode(scene.state)).toBe('view');
  });

  it('exits without saving or discarding and aborts the session signal', async () => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'Composer title');
    await session.applySpec(spec, { signal: live(), baseRevision: revision });

    session.exit();

    expect(session.signal.aborted).toBe(true);
    expect(getDashboardMode(scene.state)).toBe('view');
    expect(scene.state.isDirty).toBe(true);
    expect(scene.state.title).toBe('Composer title');
    expect(scene.getComposerSession()).toBeUndefined();
    expect(sidebarPresentation()).toBe('docked');
  });

  it('returns to clean Viewing when an edit is restored to the saved spec before exit', async () => {
    const scene = setup();
    // A loaded dashboard's saved version is fully populated; the sparse fixture JSON is not, and v1 only
    // writes `preload` once it is set.
    scene.setState({ preload: false });
    scene.setInitialSaveModel(transformSceneToSaveModel(scene));
    const session = enter(scene);
    const { spec: saved, revision } = await session.readSpec();
    const edited = await session.applySpec({ ...saved, title: 'Edited' }, { signal: live(), baseRevision: revision });
    expect(edited.status).toBe('applied');
    expect(scene.state.isDirty).toBe(true);

    const restored = await session.applySpec(saved, {
      signal: live(),
      baseRevision: edited.status === 'applied' ? edited.revision : -1,
    });
    expect(restored.status).toBe('applied');
    expect(scene.state.title).toBe('Original title');
    expect(scene.state.isDirty).toBe(false);

    session.exit();
    expect(getDashboardMode(scene.state)).toBe('view');
    expect(scene.state.isDirty).toBe(false);
  });

  it('returns to Viewing and keeps the dirty flag when a real change remains', async () => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'Still changed');
    await session.applySpec(spec, { signal: live(), baseRevision: revision });

    session.exit();

    expect(getDashboardMode(scene.state)).toBe('view');
    expect(scene.state.isDirty).toBe(true);
  });

  it('returns to Editing when entered from Editing', () => {
    const scene = setup();
    scene.setDashboardMode('edit');
    enter(scene).exit();
    expect(getDashboardMode(scene.state)).toBe('edit');
  });

  it('aborts when the scene deactivates and does not come back in Composer', () => {
    const scene = setup();
    const session = enter(scene);
    deactivate();
    deactivate = () => {};
    expect(session.signal.aborted).toBe(true);
    expect(getDashboardMode(scene.state)).not.toBe('composer');
  });

  it('aborts when the Composer flag is turned off and keeps unsaved edits', async () => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'Kept');
    await session.applySpec(spec, { signal: live(), baseRevision: revision });

    await act(async () => setTestFlags({ ...COMPOSER_FLAGS, 'grafana.dashboardComposer': false }));

    expect(session.signal.aborted).toBe(true);
    expect(getDashboardMode(scene.state)).not.toBe('composer');
    expect(scene.state.title).toBe('Kept');
  });

  it.each([
    ['openFullEditor', (scene: DashboardScene) => scene.openFullEditor()],
    ['the mode picker', (scene: DashboardScene) => scene.setDashboardMode('edit', 'picker')],
    ['an edit panel URL', (scene: DashboardScene) => scene.urlSync?.updateFromUrl({ editPanel: '1' })],
  ])('leaves Composer before a manual edit entry point: %s', async (_, open) => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'Before manual edit');
    await session.applySpec(spec, { signal: live(), baseRevision: revision });

    open(scene);

    expect(session.signal.aborted).toBe(true);
    expect(getDashboardMode(scene.state)).toBe('edit');
    expect(scene.state.title).toBe('Before manual edit');
    expect(scene.state.isDirty).toBe(true);
  });

  it('closes when the edit session is discarded', () => {
    const scene = setup();
    const session = enter(scene);
    scene.exitEditMode({ skipConfirm: true });
    expect(session.signal.aborted).toBe(true);
  });
});

describe('checked apply', () => {
  it('applies inside the edit session, bumps the revision and supports native undo after exit', async () => {
    const scene = setup();
    scene.setDashboardMode('edit');
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'Applied');

    const outcome = await session.applySpec(spec, { signal: live(), baseRevision: revision });

    expect(outcome).toMatchObject({ status: 'applied', revision: revision + 1 });
    expect(outcome.status === 'applied' && outcome.appliedSpec.title).toBe('Applied');
    expect(scene.state.title).toBe('Applied');
    expect(scene.state.isDirty).toBe(true);
    expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
    expect((await session.readSpec()).revision).toBe(revision + 1);

    session.exit();
    scene.state.sidebar.undoAction();
    expect(scene.state.title).toBe('Original title');
  });

  it('counts edits from other sources, so a write prepared before them is stale', async () => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'Mine');

    // Another writer changes the dashboard (here the generic Mutation API) after the read.
    const other = JSON.parse(getDashboardResourceText(scene)).spec;
    other.title = 'Theirs';
    await new DashboardMutationClient(scene).execute(
      { type: 'APPLY_SPEC', payload: { spec: other } },
      'grafana-assistant-app'
    );

    const outcome = await session.applySpec(spec, { signal: live(), baseRevision: revision });
    expect(outcome.status).toBe('stale');
    expect(scene.state.title).toBe('Theirs');
  });

  // Since #133913 a rebuilt ad hoc variable resolves its data source after the build, outside the write. The
  // result must reach the live variable, and must not count as a change, or every write would make the next
  // one stale.
  it('keeps its revision through the lookups a rebuilt spec finishes later', async () => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await session.readSpec();
    const withAdhoc = {
      ...spec,
      variables: [
        ...spec.variables,
        {
          kind: 'AdhocVariable' as const,
          group: 'prometheus',
          datasource: { name: 'gdev-prometheus' },
          spec: {
            name: 'filters',
            baseFilters: [],
            filters: [],
            defaultKeys: [],
            hide: 'dontHide' as const,
            skipUrlSync: false,
            allowCustomValue: true,
          },
        },
      ],
    };

    const applied = await session.applySpec(withAdhoc, { signal: live(), baseRevision: revision });
    expect(applied).toMatchObject({ status: 'applied', revision: revision + 1 });
    // Let the data source lookup land.
    await act(async () => {});

    expect(sceneGraph.lookupVariable('filters', scene)?.state).toMatchObject({ supportsMultiValueOperators: true });
    expect((await session.readSpec()).revision).toBe(revision + 1);
    const next = await session.applySpec(
      { ...withAdhoc, title: 'Next' },
      { signal: live(), baseRevision: revision + 1 }
    );
    expect(next.status).toBe('applied');
  });

  it('refuses a second write from the same base revision', async () => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'First');
    expect((await session.applySpec(spec, { signal: live(), baseRevision: revision })).status).toBe('applied');

    const outcome = await session.applySpec({ ...spec, title: 'Second' }, { signal: live(), baseRevision: revision });
    expect(outcome.status).toBe('stale');
    expect(scene.state.title).toBe('First');
  });

  it.each([
    [
      'aborted',
      'an aborted signal',
      (_scene: DashboardScene, _session: ComposerSession) => {
        const controller = new AbortController();
        controller.abort();
        return controller.signal;
      },
    ],
    [
      'closed',
      'a closed session',
      (_scene: DashboardScene, session: ComposerSession) => {
        session.exit();
        return live();
      },
    ],
    [
      'denied',
      'lost edit permission',
      (scene: DashboardScene) => {
        scene.setState({ meta: { ...scene.state.meta, canEdit: false } });
        return live();
      },
    ],
    [
      'closed',
      'the Composer flag turned off',
      () => {
        setTestFlags({ ...COMPOSER_FLAGS, 'grafana.dashboardComposer': false });
        return live();
      },
    ],
  ] as const)('returns %s and writes nothing on %s', async (status, _, arrange) => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'Refused');
    const undoDepth = scene.state.sidebar.state.undoStack.length;

    const signal = arrange(scene, session);
    const outcome = await session.applySpec(spec, { signal, baseRevision: revision });

    expect(outcome.status).toBe(status);
    expect(scene.state.title).toBe('Original title');
    expect(scene.state.sidebar.state.undoStack).toHaveLength(undoDepth);
  });

  it('returns invalid for a spec that fails validation and writes nothing', async () => {
    const scene = setup();
    const session = enter(scene);
    const { revision } = await session.readSpec();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- deliberately invalid input
    const outcome = await session.applySpec({ title: 42 } as never, { signal: live(), baseRevision: revision });
    expect(outcome.status).toBe('invalid');
    expect(scene.state.title).toBe('Original title');
  });

  it('writes to its own scene even when another document is newer on the mutation stack', async () => {
    const scene = setup();
    const session = enter(scene);
    const other = transformSaveModelToScene({
      dashboard: { title: 'Other', uid: 'other', version: 1, schemaVersion: 39, panels: [] },
      meta: { canEdit: true, canSave: true },
    });
    setDashboardMutationClientForTests(new DashboardMutationClient(other));
    try {
      const { spec, revision } = await retitled(session, 'Bound');
      expect((await session.applySpec(spec, { signal: live(), baseRevision: revision })).status).toBe('applied');
      expect(scene.state.title).toBe('Bound');
      expect(other.state.title).toBe('Other');
    } finally {
      setDashboardMutationClientForTests(null);
    }
  });
});

describe('picking', () => {
  it('resolves a panel pick by its v2 panel id', async () => {
    const scene = setup();
    const session = enter(scene);
    const pick = session.pickElement(live());
    expect(session.getOverlayState().picking).toBe(true);

    session.completePick(session.resolveElementPick('panel-1'));

    await expect(pick).resolves.toEqual({
      ref: { kind: 'panel', panelId: 1 },
      label: 'Notes',
      tabPath: [],
      point: { x: 0, y: 0 },
    });
    expect(session.getOverlayState().picking).toBe(false);
    expect(session.findElementRoot({ kind: 'panel', panelId: 1 })).toBeNull();
  });

  it('cancels a pick on pause, on the caller signal and on exit, and refuses picks while paused', async () => {
    const scene = setup();
    const session = enter(scene);

    const paused = session.pickElement(live());
    session.setPaused(true);
    await expect(paused).resolves.toBeNull();
    await expect(session.pickElement(live())).resolves.toBeNull();
    session.setPaused(false);

    const controller = new AbortController();
    const aborted = session.pickElement(controller.signal);
    controller.abort();
    await expect(aborted).resolves.toBeNull();

    const exited = session.pickElement(live());
    session.exit();
    await expect(exited).resolves.toBeNull();
  });

  it('keeps the highlight target for the overlay', () => {
    const scene = setup();
    const session = enter(scene);
    session.highlight({ kind: 'panel', panelId: 1 });
    expect(session.getOverlayState().highlight).toEqual({ kind: 'panel', panelId: 1 });
    expect(session.listElements()).toEqual([]);
  });
});

it('keeps generic plugin writes out while Composer is active', async () => {
  const scene = setup();
  enter(scene);
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  spec.title = 'Plugin write';
  const result = await new DashboardMutationClient(scene).execute(
    { type: 'APPLY_SPEC', payload: { spec } },
    'another-app'
  );
  expect(result.success).toBe(false);
  expect(scene.state.title).toBe('Original title');
});

it('applyDashboardSpec preserves Composer mode across the swap and its undo', () => {
  const scene = setup();
  const session = enter(scene);
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  scene.withAssistantWrite(() =>
    applyDashboardSpec({ scene, spec: { ...spec, title: 'Swapped' }, description: 'test', scope: 'test' })
  );
  expect(getDashboardMode(scene.state)).toBe('composer');
  expect(session.signal.aborted).toBe(false);
});

describe('telemetry', () => {
  let ended: jest.SpyInstance;
  let applied: jest.SpyInstance;
  let periodEnded: jest.SpyInstance;

  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
    ended = jest.spyOn(DashboardInteractions, 'composerSessionEnded');
    applied = jest.spyOn(DashboardInteractions, 'composerSpecApplied');
    periodEnded = jest.spyOn(DashboardInteractions, 'editPeriodEnded');
  });

  afterEach(() => {
    [ended, applied, periodEnded].forEach((spy) => spy.mockRestore());
  });

  const exitTriggers = () =>
    jest
      .mocked(reportInteraction)
      .mock.calls.filter(
        ([name, properties]) => name === 'dashboards_mode_changed' && properties?.previous_mode === 'composer'
      )
      .map(([, properties]) => properties?.trigger);

  it.each([
    ['the plugin exits', (session: ComposerSession) => session.exit(), 'plugin_exit', 'composer_plugin_exit'],
    [
      'the mode picker leaves for Viewing',
      (_: ComposerSession, scene: DashboardScene) => scene.switchFromComposer('view'),
      'mode_picker',
      'picker',
    ],
    [
      'the mode picker leaves for Editing',
      (_: ComposerSession, scene: DashboardScene) => scene.switchFromComposer('edit'),
      'mode_picker',
      'picker',
    ],
    [
      'a mode is picked',
      (_: ComposerSession, scene: DashboardScene) => scene.setDashboardMode('edit', 'picker'),
      'mode_picker',
      'picker',
    ],
    [
      'the full editor opens',
      (_: ComposerSession, scene: DashboardScene) => scene.openFullEditor(),
      'manual_edit',
      'manual_change',
    ],
    [
      'an edit panel URL opens',
      (_: ComposerSession, scene: DashboardScene) => scene.urlSync?.updateFromUrl({ editPanel: '1' }),
      'manual_edit',
      'manual_change',
    ],
    [
      'the panel menu edits',
      (_: ComposerSession, scene: DashboardScene) => scene.setDashboardMode('edit', 'panel_menu'),
      'manual_edit',
      'manual_change',
    ],
    [
      'the scene deactivates',
      () => {
        deactivate();
        deactivate = () => {};
      },
      'navigation',
      'navigation',
    ],
  ])('reports why the session ended when %s, once, and the mode change it caused', (_, leave, reason, trigger) => {
    const scene = setup();
    const session = enter(scene);
    const editSessionId = scene.getEditSessionId();

    leave(session, scene);
    session.exit();

    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboard_uid: 'composer-test',
        edit_session_id: editSessionId,
        composer_session_id: session.sessionId,
        reason,
      })
    );
    expect(exitTriggers()).toEqual([trigger]);
  });

  it('reports the flag turning off', async () => {
    const scene = setup();
    const session = enter(scene);

    await act(async () => setTestFlags({ ...COMPOSER_FLAGS, 'grafana.dashboardComposer': false }));

    expect(session.isClosed).toBe(true);
    expect(ended).toHaveBeenCalledWith(expect.objectContaining({ reason: 'flag_off' }));
    expect(exitTriggers()).toEqual(['composer_flag_off']);
  });

  it('reports a session a discard ends as a manual edit', () => {
    const scene = setup();
    enter(scene);
    scene.exitEditMode({ skipConfirm: true });
    expect(ended).toHaveBeenCalledWith(expect.objectContaining({ reason: 'manual_edit' }));
  });

  it('keeps the enter trigger', () => {
    const scene = setup();
    enter(scene);
    expect(reportInteraction).toHaveBeenCalledWith(
      'dashboards_mode_changed',
      expect.objectContaining({ previous_mode: 'view', mode: 'composer', trigger: 'composer' })
    );
  });

  it('counts the applies the session made and refused, and reports what is left unsaved', async () => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'Counted');
    expect((await session.applySpec(spec, { signal: live(), baseRevision: revision })).status).toBe('applied');
    expect((await session.applySpec(spec, { signal: live(), baseRevision: revision })).status).toBe('stale');

    session.exit();

    expect(ended).toHaveBeenCalledWith({
      dashboard_uid: 'composer-test',
      edit_session_id: expect.any(String),
      composer_session_id: session.sessionId,
      reason: 'plugin_exit',
      duration_s: expect.any(Number),
      applies_applied: 1,
      applies_refused: 1,
      region_captures: 0,
      has_unsaved_changes: true,
    });
  });

  it('reports every apply with its outcome, after the outcome is decided', async () => {
    const scene = setup();
    const session = enter(scene);
    const { spec, revision } = await retitled(session, 'Reported');
    await session.applySpec(spec, { signal: live(), baseRevision: revision });
    await session.applySpec(spec, { signal: live(), baseRevision: revision });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- an invalid spec on purpose
    await session.applySpec({ title: 42 } as unknown as typeof spec, { signal: live(), baseRevision: revision });
    const aborted = new AbortController();
    aborted.abort();
    await session.applySpec(spec, { signal: aborted.signal, baseRevision: revision + 1 });
    session.exit();
    await session.applySpec(spec, { signal: live(), baseRevision: revision + 1 });

    expect(applied.mock.calls.map(([properties]) => properties.status)).toEqual([
      'applied',
      'stale',
      'invalid',
      'aborted',
      'closed',
    ]);
    expect(applied).toHaveBeenCalledWith({
      dashboard_uid: 'composer-test',
      composer_session_id: session.sessionId,
      status: 'applied',
      duration_ms: expect.any(Number),
    });
  });

  it('attributes the edit period a session ran in to Composer, counting its sessions', () => {
    const scene = setup();
    enter(scene).exit();
    scene.setDashboardMode('edit');
    enter(scene).exit();

    expect(scene.getEditSessionTracking()).toMatchObject({ composer_used: true, composer_sessions: 2 });
    scene.exitEditMode({ skipConfirm: true });

    expect(periodEnded).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'exited', composer_used: true, composer_sessions: 2 })
    );
  });

  it('does not attribute an edit period without a session to Composer', () => {
    const scene = setup();
    scene.setDashboardMode('edit');
    expect(scene.getEditSessionTracking()).toMatchObject({ composer_used: false, composer_sessions: 0 });
  });

  it('counts a session still open when a new edit period starts in it', async () => {
    const scene = setup();
    const session = enter(scene);
    const first = scene.getEditSessionId();
    // Ends the period, as a save does.
    scene.exitEditMode({ skipConfirm: true, restoreInitialState: false });
    expect(session.isClosed).toBe(true);
    const next = enter(scene);
    expect(scene.getEditSessionId()).not.toBe(first);
    expect(scene.getEditSessionTracking()).toMatchObject({ composer_used: true, composer_sessions: 1 });
    next.exit();
  });
});
