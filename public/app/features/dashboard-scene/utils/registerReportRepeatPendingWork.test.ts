import { behaviors, sceneGraph, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import {
  registerPendingWork,
  registerReportRepeatPendingWork,
  RELEASE_FALLBACK_MS,
} from './registerReportRepeatPendingWork';

jest.mock('app/features/dashboard/services/isRenderTarget', () => ({
  isRenderTarget: jest.fn(),
}));

class TestSceneObject extends SceneObjectBase<SceneObjectState> {}

// Hold is a local queryStarted/queryCompleted entry; release when all clones activate
// (or via RELEASE_FALLBACK_MS).
function buildQueryController() {
  const controller = new behaviors.SceneQueryController();
  const queryStarted = jest.spyOn(controller, 'queryStarted');
  const queryCompleted = jest.spyOn(controller, 'queryCompleted');

  jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(controller);

  return { controller, queryStarted, queryCompleted };
}

describe('registerReportRepeatPendingWork', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(isRenderTarget).mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('when registration is guarded off', () => {
    it('when clones is empty on a render target, then it does not look up the query controller', () => {
      const getQueryControllerSpy = jest.spyOn(sceneGraph, 'getQueryController');
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, []);

      expect(getQueryControllerSpy).not.toHaveBeenCalled();
    });

    it('when the page is not a render target, then it does not register pending work', () => {
      const { queryStarted } = buildQueryController();
      jest.mocked(isRenderTarget).mockReturnValue(false);
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);

      expect(queryStarted).not.toHaveBeenCalled();
    });

    it('when the scene has no query controller, then it does nothing and does not throw', () => {
      jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(undefined);
      const origin = new TestSceneObject({});

      expect(() => registerReportRepeatPendingWork(origin, [new TestSceneObject({})])).not.toThrow();
    });
  });

  describe('when on a render target with a query controller', () => {
    it('registers pending work with type "repeat" and the origin object', () => {
      const { queryStarted } = buildQueryController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);

      expect(queryStarted).toHaveBeenCalledTimes(1);
      expect(queryStarted).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'repeat',
          origin,
          cancel: expect.any(Function),
        })
      );
    });

    it('while at least one clone is still inactive, then it does not release', () => {
      const { queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});
      const activatedClone = new TestSceneObject({});
      const inactiveClone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [activatedClone, inactiveClone]);
      activatedClone.activate();

      expect(queryCompleted).not.toHaveBeenCalled();
    });

    it('when the last clone activates, then it releases exactly once', () => {
      const { queryStarted, queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});
      const firstClone = new TestSceneObject({});
      const secondClone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [firstClone, secondClone]);
      firstClone.activate();
      secondClone.activate();

      expect(queryCompleted).toHaveBeenCalledTimes(1);
      expect(queryCompleted).toHaveBeenCalledWith(queryStarted.mock.calls[0][0]);
    });

    it('when all clones are already active at call time, then it releases immediately', () => {
      const { queryStarted, queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});
      const clone = new TestSceneObject({});
      clone.activate();

      registerReportRepeatPendingWork(origin, [clone]);

      expect(queryCompleted).toHaveBeenCalledTimes(1);
      expect(queryCompleted).toHaveBeenCalledWith(queryStarted.mock.calls[0][0]);
    });

    it('when clones never activate, then it releases through the fallback timeout', () => {
      const { queryStarted, queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      jest.advanceTimersByTime(RELEASE_FALLBACK_MS);

      expect(queryCompleted).toHaveBeenCalledTimes(1);
      expect(queryCompleted).toHaveBeenCalledWith(queryStarted.mock.calls[0][0]);
    });

    it('when a clone activates after the fallback already fired, then it does not release a second time', () => {
      const { queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});
      const clone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [clone]);
      jest.advanceTimersByTime(RELEASE_FALLBACK_MS);
      clone.activate();

      expect(queryCompleted).toHaveBeenCalledTimes(1);
    });

    it('after an activation-based release, then advancing past the fallback timeout does not release again', () => {
      const { queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});
      const clone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [clone]);
      clone.activate();
      jest.advanceTimersByTime(RELEASE_FALLBACK_MS);

      expect(queryCompleted).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the same origin re-registers before the previous clones activated', () => {
    it('releases the superseded hold exactly once and keeps the new hold pending', () => {
      const { queryStarted, queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);

      const [firstEntry, secondEntry] = [queryStarted.mock.calls[0][0], queryStarted.mock.calls[1][0]];
      expect(queryCompleted).toHaveBeenCalledTimes(1);
      expect(queryCompleted).toHaveBeenCalledWith(firstEntry);
      expect(queryCompleted).not.toHaveBeenCalledWith(secondEntry);
    });

    it('registers the new hold before releasing the old one, so the running count never crosses zero', () => {
      const { queryStarted, queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);

      expect(queryStarted.mock.invocationCallOrder[1]).toBeLessThan(queryCompleted.mock.invocationCallOrder[0]);
    });

    it('after superseding, the old fallback timeout does not release the old hold a second time', () => {
      const { queryStarted, queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      jest.advanceTimersByTime(RELEASE_FALLBACK_MS);

      const firstEntry = queryStarted.mock.calls[0][0];
      expect(queryCompleted.mock.calls.filter(([entry]) => entry === firstEntry)).toHaveLength(1);
    });

    it('when the re-repeat produces no clones, then it releases the previous hold without registering a new one', () => {
      const { queryStarted, queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(origin, []);

      expect(queryStarted).toHaveBeenCalledTimes(1);
      expect(queryCompleted).toHaveBeenCalledTimes(1);
      expect(queryCompleted).toHaveBeenCalledWith(queryStarted.mock.calls[0][0]);
    });

    it('holds from different origins stay independent', () => {
      const { queryCompleted } = buildQueryController();
      const firstOrigin = new TestSceneObject({});
      const secondOrigin = new TestSceneObject({});

      registerReportRepeatPendingWork(firstOrigin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(secondOrigin, [new TestSceneObject({})]);

      expect(queryCompleted).not.toHaveBeenCalled();
    });

    it('when the discarded clones activate later, then they do not release the new hold', () => {
      const { queryStarted, queryCompleted } = buildQueryController();
      const origin = new TestSceneObject({});
      const discardedClone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [discardedClone]);
      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      discardedClone.activate();

      const [firstEntry, secondEntry] = [queryStarted.mock.calls[0][0], queryStarted.mock.calls[1][0]];
      expect(queryCompleted).toHaveBeenCalledTimes(1);
      expect(queryCompleted).toHaveBeenCalledWith(firstEntry);
      expect(queryCompleted).not.toHaveBeenCalledWith(secondEntry);
    });
  });
});

describe('registerPendingWork', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('when the scene has no query controller, then it returns a no-op release and does not throw', () => {
    jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(undefined);
    const origin = new TestSceneObject({});

    const release = registerPendingWork('repeat', origin);

    expect(() => release()).not.toThrow();
  });

  it('starts a query controller entry with the given type and origin', () => {
    const controller = new behaviors.SceneQueryController();
    const queryStarted = jest.spyOn(controller, 'queryStarted');
    jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(controller);
    const origin = new TestSceneObject({});

    registerPendingWork('repeat', origin);

    expect(queryStarted).toHaveBeenCalledTimes(1);
    expect(queryStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'repeat',
        origin,
        cancel: expect.any(Function),
      })
    );
  });

  it('when released, then it completes the same entry exactly once', () => {
    const controller = new behaviors.SceneQueryController();
    const queryStarted = jest.spyOn(controller, 'queryStarted');
    const queryCompleted = jest.spyOn(controller, 'queryCompleted');
    jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(controller);
    const origin = new TestSceneObject({});

    const release = registerPendingWork('repeat', origin);
    release();
    release();

    expect(queryCompleted).toHaveBeenCalledTimes(1);
    expect(queryCompleted).toHaveBeenCalledWith(queryStarted.mock.calls[0][0]);
  });

  it('when the entry cancel callback runs, then it completes the entry', () => {
    const controller = new behaviors.SceneQueryController();
    const queryStarted = jest.spyOn(controller, 'queryStarted');
    const queryCompleted = jest.spyOn(controller, 'queryCompleted');
    jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(controller);
    const origin = new TestSceneObject({});

    registerPendingWork('repeat', origin);
    const entry = queryStarted.mock.calls[0][0];
    entry.cancel?.();

    expect(queryCompleted).toHaveBeenCalledTimes(1);
    expect(queryCompleted).toHaveBeenCalledWith(entry);
  });

  it('when cancel runs then release is called, then the entry completes exactly once', () => {
    const controller = new behaviors.SceneQueryController();
    const queryStarted = jest.spyOn(controller, 'queryStarted');
    const queryCompleted = jest.spyOn(controller, 'queryCompleted');
    jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(controller);
    const origin = new TestSceneObject({});

    const release = registerPendingWork('repeat', origin);
    const entry = queryStarted.mock.calls[0][0];
    entry.cancel?.();
    release();

    expect(queryCompleted).toHaveBeenCalledTimes(1);
    expect(queryCompleted).toHaveBeenCalledWith(entry);
  });
});
