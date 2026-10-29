import { AppEvents } from '@grafana/data';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { type DashboardScene } from '../scene/DashboardScene';

import { type PendingChangesHistory } from './pendingChangePreview';
import { recordPendingChange, reloadKeepingEditMode, startRecordingPendingChanges } from './pendingChangesHistory';

jest.mock('app/core/app_events', () => ({ appEvents: { emit: jest.fn() } }));
jest.mock('../pages/DashboardScenePageStateManager', () => ({ getDashboardScenePageStateManager: jest.fn() }));

/** A v2 spec with one panel per title, as the elements part of a save model. */
function specWith(panels: Record<string, Record<string, unknown>>): DashboardV2Spec {
  return {
    title: 'Pending',
    elements: Object.fromEntries(Object.entries(panels).map(([name, spec]) => [name, { kind: 'Panel', spec }])),
    layout: { kind: 'AutoGridLayout', spec: { items: [] } },
  } as unknown as DashboardV2Spec;
}

function fakeScene(saveModel: () => DashboardV2Spec, isEditing = true) {
  return {
    state: { uid: 'abc', meta: {}, isEditing },
    getSaveModel: jest.fn(saveModel),
    markPendingChangesRecorded: jest.fn(),
  } as unknown as DashboardScene & { markPendingChangesRecorded: jest.Mock };
}

function fakeHistory(recorded = true) {
  return {
    record: jest.fn().mockResolvedValue({ recorded }),
    undo: jest.fn(),
    redo: jest.fn(),
    getState: () => ({}),
    subscribe: () => () => {},
  } satisfies PendingChangesHistory;
}

describe('recording edits to pending changes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records only what the edit changed, onto the pending changes as stored', async () => {
    // The stored spec leaves out defaults the scene fills in, such as a plugin version.
    const stored = specWith({ hello: { title: 'Hello' } });
    let model = specWith({ hello: { title: 'Hello', version: '13.0.0' } });
    const scene = fakeScene(() => model);
    startRecordingPendingChanges(scene, stored);
    const history = fakeHistory();

    model = specWith({ hello: { title: 'Hello', version: '13.0.0' }, added: { title: 'Added' } });
    await recordPendingChange(scene, history, 'Add Panel');

    expect(history.record).toHaveBeenCalledWith({
      proposed: specWith({ hello: { title: 'Hello' }, added: { title: 'Added' } }),
      description: 'Add Panel',
    });
    expect(scene.markPendingChangesRecorded).toHaveBeenCalledWith(model);
  });

  it('takes the scene before the edit from the caller, so defaults filled in since count as unchanged', async () => {
    const stored = specWith({ hello: { title: 'Hello' } });
    const scene = fakeScene(() => specWith({ hello: { title: 'Renamed', version: '13.0.0' } }));
    startRecordingPendingChanges(scene, stored);
    const history = fakeHistory();

    await recordPendingChange(
      scene,
      history,
      'panel title change',
      specWith({ hello: { title: 'Hello', version: '13.0.0' } })
    );

    expect(history.record).toHaveBeenCalledWith({
      proposed: specWith({ hello: { title: 'Renamed' } }),
      description: 'panel title change',
    });
  });

  it('records nothing when the edit changed nothing', async () => {
    const model = specWith({ hello: { title: 'Hello', version: '13.0.0' } });
    const scene = fakeScene(() => model);
    startRecordingPendingChanges(scene, specWith({ hello: { title: 'Hello' } }));
    const history = fakeHistory();

    await recordPendingChange(scene, history, 'Edit dashboard', model);

    expect(history.record).not.toHaveBeenCalled();
  });

  it('shows the latest pending changes, still editing, when they changed meanwhile', async () => {
    const reloaded = { state: { isEditing: false }, onEnterEditMode: jest.fn() };
    const reloadDashboardFresh = jest.fn().mockResolvedValue(undefined);
    jest
      .mocked(getDashboardScenePageStateManager)
      .mockReturnValue({ reloadDashboardFresh, state: { dashboard: reloaded } } as never);
    const scene = fakeScene(() => specWith({ hello: { title: 'Hello' } }));

    await recordPendingChange(scene, fakeHistory(false), 'Add Panel');

    expect(appEvents.emit).toHaveBeenCalledWith(AppEvents.alertWarning, expect.any(Array));
    expect(reloadDashboardFresh).toHaveBeenCalledWith(expect.objectContaining({ uid: 'abc' }));
    expect(reloaded.onEnterEditMode).toHaveBeenCalled();
  });
});

describe('reloading pending changes', () => {
  it('leaves a scene that wasn’t editing in view mode', async () => {
    const reloaded = { state: { isEditing: false }, onEnterEditMode: jest.fn() };
    jest.mocked(getDashboardScenePageStateManager).mockReturnValue({
      reloadDashboardFresh: jest.fn().mockResolvedValue(undefined),
      state: { dashboard: reloaded },
    } as never);

    await reloadKeepingEditMode('abc', false);

    expect(reloaded.onEnterEditMode).not.toHaveBeenCalled();
  });
});
