import { behaviors, sceneGraph, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import { registerReportRepeatPendingWork, RELEASE_FALLBACK_MS } from './registerReportRepeatPendingWork';

jest.mock('app/features/dashboard/services/isRenderTarget', () => ({
  isRenderTarget: jest.fn(),
}));

class TestSceneObject extends SceneObjectBase<SceneObjectState> {}

// The pinned @grafana/scenes version does not expose registerPendingWork yet,
// so the supporting controller is a real SceneQueryController with the method attached.
function buildSupportingController() {
  const release = jest.fn();
  const registerPendingWork = jest.fn(() => release);
  const controller = Object.assign(new behaviors.SceneQueryController(), { registerPendingWork });

  jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(controller);

  return { controller, registerPendingWork, release };
}

// Variant returning a distinct release mock per registration, for supersede scenarios.
function buildMultiHoldController() {
  const releases: jest.Mock[] = [];
  const registerPendingWork = jest.fn(() => {
    const release = jest.fn();
    releases.push(release);
    return release;
  });
  const controller = Object.assign(new behaviors.SceneQueryController(), { registerPendingWork });

  jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(controller);

  return { controller, registerPendingWork, releases };
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
    it('when clones is empty, then it does not look up the query controller', () => {
      const getQueryControllerSpy = jest.spyOn(sceneGraph, 'getQueryController');
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, []);

      expect(getQueryControllerSpy).not.toHaveBeenCalled();
    });

    it('when the page is not a render target, then it does not register pending work', () => {
      const { registerPendingWork } = buildSupportingController();
      jest.mocked(isRenderTarget).mockReturnValue(false);
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);

      expect(registerPendingWork).not.toHaveBeenCalled();
    });

    it('when the scene has no query controller, then it does nothing and does not throw', () => {
      jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(undefined);
      const origin = new TestSceneObject({});

      expect(() => registerReportRepeatPendingWork(origin, [new TestSceneObject({})])).not.toThrow();
    });

    it('when the controller does not support registerPendingWork, then it does nothing and does not throw', () => {
      jest.spyOn(sceneGraph, 'getQueryController').mockReturnValue(new behaviors.SceneQueryController());
      const origin = new TestSceneObject({});

      expect(() => registerReportRepeatPendingWork(origin, [new TestSceneObject({})])).not.toThrow();
    });
  });

  describe('when on a render target with a supporting controller', () => {
    it('registers pending work with type "repeat" and the origin object', () => {
      const { registerPendingWork } = buildSupportingController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);

      expect(registerPendingWork).toHaveBeenCalledTimes(1);
      expect(registerPendingWork).toHaveBeenCalledWith('repeat', origin);
    });

    it('while at least one clone is still inactive, then it does not release', () => {
      const { release } = buildSupportingController();
      const origin = new TestSceneObject({});
      const activatedClone = new TestSceneObject({});
      const inactiveClone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [activatedClone, inactiveClone]);
      activatedClone.activate();

      expect(release).not.toHaveBeenCalled();
    });

    it('when the last clone activates, then it releases exactly once', () => {
      const { release } = buildSupportingController();
      const origin = new TestSceneObject({});
      const firstClone = new TestSceneObject({});
      const secondClone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [firstClone, secondClone]);
      firstClone.activate();
      secondClone.activate();

      expect(release).toHaveBeenCalledTimes(1);
    });

    it('when all clones are already active at call time, then it releases immediately', () => {
      const { release } = buildSupportingController();
      const origin = new TestSceneObject({});
      const clone = new TestSceneObject({});
      clone.activate();

      registerReportRepeatPendingWork(origin, [clone]);

      expect(release).toHaveBeenCalledTimes(1);
    });

    it('when clones never activate, then it releases through the fallback timeout', () => {
      const { release } = buildSupportingController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      jest.advanceTimersByTime(RELEASE_FALLBACK_MS);

      expect(release).toHaveBeenCalledTimes(1);
    });

    it('when a clone activates after the fallback already fired, then it does not release a second time', () => {
      const { release } = buildSupportingController();
      const origin = new TestSceneObject({});
      const clone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [clone]);
      jest.advanceTimersByTime(RELEASE_FALLBACK_MS);
      clone.activate();

      expect(release).toHaveBeenCalledTimes(1);
    });

    it('after an activation-based release, then advancing past the fallback timeout does not release again', () => {
      const { release } = buildSupportingController();
      const origin = new TestSceneObject({});
      const clone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [clone]);
      clone.activate();
      jest.advanceTimersByTime(RELEASE_FALLBACK_MS);

      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the same origin re-registers before the previous clones activated', () => {
    it('releases the superseded hold exactly once and keeps the new hold pending', () => {
      const { releases } = buildMultiHoldController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);

      expect(releases[0]).toHaveBeenCalledTimes(1);
      expect(releases[1]).not.toHaveBeenCalled();
    });

    it('registers the new hold before releasing the old one, so the running count never crosses zero', () => {
      const { registerPendingWork, releases } = buildMultiHoldController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);

      expect(registerPendingWork.mock.invocationCallOrder[1]).toBeLessThan(releases[0].mock.invocationCallOrder[0]);
    });

    it('after superseding, the old fallback timeout does not release the old hold a second time', () => {
      const { releases } = buildMultiHoldController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      jest.advanceTimersByTime(RELEASE_FALLBACK_MS);

      expect(releases[0]).toHaveBeenCalledTimes(1);
    });

    it('when the re-repeat produces no clones, then it releases the previous hold without registering a new one', () => {
      const { registerPendingWork, releases } = buildMultiHoldController();
      const origin = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(origin, []);

      expect(registerPendingWork).toHaveBeenCalledTimes(1);
      expect(releases[0]).toHaveBeenCalledTimes(1);
    });

    it('holds from different origins stay independent', () => {
      const { releases } = buildMultiHoldController();
      const firstOrigin = new TestSceneObject({});
      const secondOrigin = new TestSceneObject({});

      registerReportRepeatPendingWork(firstOrigin, [new TestSceneObject({})]);
      registerReportRepeatPendingWork(secondOrigin, [new TestSceneObject({})]);

      expect(releases[0]).not.toHaveBeenCalled();
      expect(releases[1]).not.toHaveBeenCalled();
    });

    it('when the discarded clones activate later, then they do not release the new hold', () => {
      const { releases } = buildMultiHoldController();
      const origin = new TestSceneObject({});
      const discardedClone = new TestSceneObject({});

      registerReportRepeatPendingWork(origin, [discardedClone]);
      registerReportRepeatPendingWork(origin, [new TestSceneObject({})]);
      discardedClone.activate();

      expect(releases[0]).toHaveBeenCalledTimes(1);
      expect(releases[1]).not.toHaveBeenCalled();
    });
  });
});
