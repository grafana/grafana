import { renderHook } from '@testing-library/react';

import { AppEvents } from '@grafana/data';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';

import { type DashboardScene } from '../scene/DashboardScene';

import { type PendingChangesHistory } from './pendingChangePreview';
import {
  hasUnrecordedPendingChange,
  pendingChangesRecorded,
  pendingChangesSuperseded,
  recordPendingChange,
  reloadKeepingEditMode,
  resumeRecordingPendingChanges,
  startRecordingPendingChanges,
  usePendingChangesHistoryState,
} from './pendingChangesHistory';
import { setPendingChangesPageReload } from './pendingChangesPageReload';

jest.mock('app/core/app_events', () => ({ appEvents: { emit: jest.fn() } }));

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

  // Leaving the page would otherwise drop the edit: the scene counts as recorded once the request starts.
  it('retries an edit the plugin failed to record, even when nothing changed since', async () => {
    let model = specWith({ hello: { title: 'Hello' } });
    const scene = fakeScene(() => model);
    startRecordingPendingChanges(scene, model);
    const history = fakeHistory();
    history.record.mockRejectedValueOnce(new Error('offline'));

    model = specWith({ hello: { title: 'Renamed' } });
    await recordPendingChange(scene, history, 'panel title change');
    expect(appEvents.emit).toHaveBeenCalledWith(AppEvents.alertError, expect.any(Array));
    expect(hasUnrecordedPendingChange(scene)).toBe(true);

    await recordPendingChange(scene, history, 'Edit dashboard');
    expect(history.record).toHaveBeenLastCalledWith({ proposed: model, description: 'Edit dashboard' });
    expect(hasUnrecordedPendingChange(scene)).toBe(false);
  });

  // Leaving edit mode and coming back mustn't make the failed edit look unchanged.
  it('keeps a failed edit in the next recording after edit mode starts again', async () => {
    const stored = specWith({ hello: { title: 'Hello' } });
    let model = stored;
    const scene = fakeScene(() => model);
    startRecordingPendingChanges(scene, stored);
    const history = fakeHistory();
    history.record.mockRejectedValue(new Error('offline'));

    model = specWith({ hello: { title: 'Renamed' } });
    await recordPendingChange(scene, history, 'panel title change');
    // Exit edit retries, and fails too; then edit mode starts again over the older stored proposal.
    await recordPendingChange(scene, history, 'Edit dashboard');
    startRecordingPendingChanges(scene, stored);

    history.record.mockResolvedValue({ recorded: true });
    await recordPendingChange(scene, history, 'Edit dashboard');

    expect(history.record).toHaveBeenLastCalledWith({ proposed: model, description: 'Edit dashboard' });
    expect(hasUnrecordedPendingChange(scene)).toBe(false);
  });

  it('shows the latest pending changes, still editing, when they changed meanwhile', async () => {
    const pageReload = jest.fn().mockResolvedValue(undefined);
    setPendingChangesPageReload(pageReload);
    const scene = fakeScene(() => specWith({ hello: { title: 'Hello' } }));

    await recordPendingChange(scene, fakeHistory(false), 'Add Panel');

    expect(appEvents.emit).toHaveBeenCalledWith(AppEvents.alertWarning, expect.any(Array));
    expect(pageReload).toHaveBeenCalledWith('abc', true);
  });

  // A slower first request would otherwise land after the second, and the plugin would keep the older spec.
  it('sends recordings one after another, counting each as unrecorded until it lands', async () => {
    let model = specWith({ hello: { title: 'Hello' } });
    const scene = fakeScene(() => model);
    startRecordingPendingChanges(scene, model);
    const history = fakeHistory();
    let landFirst = () => {};
    history.record.mockImplementationOnce(
      () => new Promise((resolve) => (landFirst = () => resolve({ recorded: true })))
    );

    model = specWith({ hello: { title: 'First' } });
    const first = recordPendingChange(scene, history, 'First edit');
    model = specWith({ hello: { title: 'Second' } });
    const second = recordPendingChange(scene, history, 'Second edit');
    await Promise.resolve();

    expect(history.record).toHaveBeenCalledTimes(1);
    expect(hasUnrecordedPendingChange(scene)).toBe(true);
    landFirst();
    await Promise.all([first, second, pendingChangesRecorded(scene)]);

    expect(history.record.mock.calls.map(([change]) => change.description)).toEqual(['First edit', 'Second edit']);
    expect(hasUnrecordedPendingChange(scene)).toBe(false);
  });

  // Recorded onto pending changes that changed meanwhile, a queued edit would overwrite the newer ones.
  it('drops the recordings still queued once the pending changes changed under them', async () => {
    setPendingChangesPageReload(jest.fn().mockResolvedValue(undefined));
    let model = specWith({ hello: { title: 'Hello' } });
    const scene = fakeScene(() => model);
    startRecordingPendingChanges(scene, model);
    const history = fakeHistory();
    history.record.mockResolvedValueOnce({ recorded: false });

    model = specWith({ hello: { title: 'First' } });
    const first = recordPendingChange(scene, history, 'First edit');
    model = specWith({ hello: { title: 'Second' } });
    await Promise.all([first, recordPendingChange(scene, history, 'Second edit')]);

    expect(history.record).toHaveBeenCalledTimes(1);
    // Nothing may act on the older pending changes this scene showed, Apply included.
    expect(pendingChangesSuperseded(scene)).toBe(true);
  });

  // The same scene shows the newer pending changes after an in-place reload: an edit queued before it
  // is of the ones they replaced, and sent now it would overwrite them.
  it('drops the recordings queued before the scene was reloaded in place', async () => {
    let model = specWith({ hello: { title: 'Hello' } });
    const scene = fakeScene(() => model);
    setPendingChangesPageReload(
      jest.fn(async () => {
        resumeRecordingPendingChanges(scene);
        return true;
      })
    );
    startRecordingPendingChanges(scene, model);
    const history = fakeHistory();
    history.record.mockResolvedValueOnce({ recorded: false });

    model = specWith({ hello: { title: 'First' } });
    const first = recordPendingChange(scene, history, 'First edit');
    model = specWith({ hello: { title: 'Second' } });
    await Promise.all([first, recordPendingChange(scene, history, 'Second edit')]);

    expect(history.record).toHaveBeenCalledTimes(1);
    // Showing the newer pending changes, the scene goes on recording onto them.
    expect(pendingChangesSuperseded(scene)).toBe(false);
    model = specWith({ hello: { title: 'Third' } });
    await recordPendingChange(scene, history, 'Third edit');
    expect(history.record).toHaveBeenCalledTimes(2);
  });

  // Leaving would otherwise warn about an edit of the pending changes the reload replaced.
  it('leaves nothing unsaved once the scene was reloaded in place after an edit failed to record', async () => {
    let model = specWith({ hello: { title: 'Hello' } });
    const scene = fakeScene(() => model);
    startRecordingPendingChanges(scene, model);
    const history = fakeHistory();
    history.record.mockRejectedValueOnce(new Error('offline'));

    model = specWith({ hello: { title: 'First' } });
    await recordPendingChange(scene, history, 'First edit');
    expect(hasUnrecordedPendingChange(scene)).toBe(true);

    resumeRecordingPendingChanges(scene);
    expect(hasUnrecordedPendingChange(scene)).toBe(false);
  });

  it('leaves nothing unsaved when a recording on its way fails after the scene was reloaded in place', async () => {
    let model = specWith({ hello: { title: 'Hello' } });
    const scene = fakeScene(() => model);
    startRecordingPendingChanges(scene, model);
    const history = fakeHistory();
    let fail = (_error: Error) => {};
    history.record.mockImplementationOnce(() => new Promise((_resolve, reject) => (fail = reject)));

    model = specWith({ hello: { title: 'First' } });
    const sent = recordPendingChange(scene, history, 'First edit');
    await Promise.resolve();
    resumeRecordingPendingChanges(scene);
    fail(new Error('offline'));
    await sent;

    expect(hasUnrecordedPendingChange(scene)).toBe(false);
    expect(appEvents.emit).not.toHaveBeenCalledWith(AppEvents.alertError, expect.any(Array));
  });

  // A queue that stayed rejected would fail Apply's and Undo's wait; a scene cleared of the conflict
  // would let them act on pending changes the page never loaded.
  it('keeps the scene superseded, and its edits unrecorded, after the reload for a conflict failed', async () => {
    setPendingChangesPageReload(jest.fn().mockRejectedValue(new Error('offline')));
    let model = specWith({ hello: { title: 'Hello' } });
    const scene = fakeScene(() => model);
    startRecordingPendingChanges(scene, model);
    const history = fakeHistory();
    history.record.mockResolvedValueOnce({ recorded: false });

    model = specWith({ hello: { title: 'First' } });
    await recordPendingChange(scene, history, 'First edit');
    await expect(pendingChangesRecorded(scene)).resolves.toBeUndefined();
    expect(pendingChangesSuperseded(scene)).toBe(true);
    expect(hasUnrecordedPendingChange(scene)).toBe(true);

    model = specWith({ hello: { title: 'Second' } });
    await recordPendingChange(scene, history, 'Second edit');
    expect(history.record).toHaveBeenCalledTimes(1);
    expect(hasUnrecordedPendingChange(scene)).toBe(true);
  });
});

describe('reloading pending changes', () => {
  // The page state manager sets the reload: the scene's modules can't import it.
  it('reloads through the page', async () => {
    const pageReload = jest.fn().mockResolvedValue(undefined);
    setPendingChangesPageReload(pageReload);

    await reloadKeepingEditMode('abc', false);

    expect(pageReload).toHaveBeenCalledWith('abc', false);
  });
});

describe('usePendingChangesHistoryState', () => {
  // useSyncExternalStore re-renders forever on a snapshot that is new on every read.
  it('keeps one state object while its fields stay the same, whatever getState returns', () => {
    let state = { undo: 'Add Panel' };
    const history = { ...fakeHistory(), getState: () => ({ ...state }) };

    const { result, rerender } = renderHook(() => usePendingChangesHistoryState(history));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);

    state = { undo: 'panel title change' };
    rerender();
    expect(result.current).toEqual({ undo: 'panel title change' });
  });
});
