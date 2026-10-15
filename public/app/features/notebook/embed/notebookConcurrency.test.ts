import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';

import { NotebookPageStateManager } from '../pages/NotebookPageStateManager';
import { NotebookScene } from '../scene/NotebookScene';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

function aScene(uid: string, title = 'Investigation') {
  return new NotebookScene({
    title,
    uid,
    body: new NotebookLayoutManager({ cells: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

/**
 * A notebook can be on screen twice — the route plus an embed of the same one. Each consumer has its
 * own manager, but they have to land on one scene: a scene owns its autosave, and two autosaves both
 * writing the whole spec means the later write silently undoes the other's edits.
 */
describe('two managers, one notebook', () => {
  afterEach(() => {
    new NotebookPageStateManager({ isLoading: false }).clearSceneCache();
  });

  it('hands both consumers the same scene', async () => {
    const routeManager = new NotebookPageStateManager({ isLoading: false });
    const embedManager = new NotebookPageStateManager({ isLoading: false });
    const scene = aScene('nb-1');

    // Stands in for the fetch: what matters is that a scene cached by one manager is found by the
    // other, not how it got there.
    routeManager.setSceneCacheForTests('nb-1', scene);

    // Identity compared as a boolean, not with toBe(scene): a scene's state graph is circular, and
    // a failing toBe would try to serialise it and take the jest worker down instead of reporting.
    expect(embedManager.getCachedSceneForTests('nb-1') === scene).toBe(true);
    // And therefore one autosave, which is the thing that would otherwise clobber.
    expect(embedManager.getCachedSceneForTests('nb-1')?.autosave === scene.autosave).toBe(true);
  });

  it('keeps different notebooks apart', () => {
    const manager = new NotebookPageStateManager({ isLoading: false });
    const a = aScene('nb-a');
    const b = aScene('nb-b');

    manager.setSceneCacheForTests('nb-a', a);
    manager.setSceneCacheForTests('nb-b', b);

    expect(manager.getCachedSceneForTests('nb-a') === a).toBe(true);
    expect(manager.getCachedSceneForTests('nb-b') === b).toBe(true);
  });
});

/**
 * Panel interpolation and TimeSrv resolve through `window.__grafanaSceneContext`. Documents can be
 * mounted at once now and do not deactivate in activation order, so restoring it unconditionally
 * pointed it at a scene that had already gone.
 */
describe('the global scene context', () => {
  it('is not stolen from a newer notebook by an older one closing first', () => {
    const a = aScene('nb-a');
    const b = aScene('nb-b');

    const releaseA = a.activate();
    const releaseB = b.activate();
    expect(window.__grafanaSceneContext === b).toBe(true);

    releaseA();

    // Previously A handed the context back to whatever preceded it, dropping B while B was live.
    expect(window.__grafanaSceneContext === b).toBe(true);

    releaseB();
  });

  /**
   * The tail the ownership guard alone did not fix. Each activation used to remember its own
   * predecessor, so the LAST notebook to close handed the context to an already-deactivated
   * sibling — leaving panel interpolation and TimeSrv resolving through a dead scene.
   */
  it('returns the context to what preceded the first notebook, not to a closed one', () => {
    const before = window.__grafanaSceneContext;
    const a = aScene('nb-a');
    const b = aScene('nb-b');

    const releaseA = a.activate();
    const releaseB = b.activate();

    // Out of order on purpose: A closes while B is still live, then B closes.
    releaseA();
    releaseB();

    expect(window.__grafanaSceneContext === before).toBe(true);
    // Specifically NOT A, which is what the per-activation predecessor gave us.
    expect(window.__grafanaSceneContext === a).toBe(false);
  });

  it('gives the context back once the last notebook closes', () => {
    const before = window.__grafanaSceneContext;
    const scene = aScene('nb-1');

    const release = scene.activate();
    expect(window.__grafanaSceneContext === scene).toBe(true);

    release();

    expect(window.__grafanaSceneContext === before).toBe(true);
  });
});
