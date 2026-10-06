import { behaviors, EmbeddedScene, SceneFlexLayout } from '@grafana/scenes';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import { holdRenderReadiness } from './readiness';

jest.mock('app/features/dashboard/services/isRenderTarget', () => ({
  isRenderTarget: jest.fn(),
}));

const isRenderTargetMock = jest.mocked(isRenderTarget);

function installScene() {
  const controller = new behaviors.SceneQueryController();
  const scene = new EmbeddedScene({ $behaviors: [controller], body: new SceneFlexLayout({ children: [] }) });
  const queryStarted = jest.spyOn(controller, 'queryStarted');
  const queryCompleted = jest.spyOn(controller, 'queryCompleted');
  window.__grafanaSceneContext = scene;
  return { scene, controller, queryStarted, queryCompleted };
}

describe('holdRenderReadiness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.__grafanaRunningQueryCount = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(window, '__grafanaSceneContext');
  });

  it('holds the scene query controller until released, once', () => {
    isRenderTargetMock.mockReturnValue(true);
    const { scene, queryStarted, queryCompleted } = installScene();

    const hold = holdRenderReadiness();
    expect(queryStarted).toHaveBeenCalledTimes(1);
    expect(queryStarted).toHaveBeenCalledWith(expect.objectContaining({ type: 'plugin', origin: scene }));
    expect(window.__grafanaRunningQueryCount).toBe(1);
    expect(hold.released).toBe(false);

    hold.release();
    hold.release();
    jest.runAllTimers();
    expect(queryCompleted).toHaveBeenCalledTimes(1);
    expect(queryCompleted).toHaveBeenCalledWith(queryStarted.mock.calls[0][0]);
    expect(window.__grafanaRunningQueryCount).toBe(0);
    expect(hold.released).toBe(true);
  });

  it('releases itself after the maximum hold', () => {
    isRenderTargetMock.mockReturnValue(true);
    const { queryCompleted } = installScene();

    const hold = holdRenderReadiness({ maxHoldMs: 500 });
    jest.advanceTimersByTime(499);
    expect(queryCompleted).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(queryCompleted).toHaveBeenCalledTimes(1);
    expect(hold.released).toBe(true);
    expect(window.__grafanaRunningQueryCount).toBe(0);
  });

  it('releases when the controller cancels all queries', () => {
    isRenderTargetMock.mockReturnValue(true);
    const { controller, queryCompleted } = installScene();

    const hold = holdRenderReadiness();
    controller.cancelAll();
    expect(hold.released).toBe(true);
    expect(queryCompleted).toHaveBeenCalledTimes(1);
  });

  it('is a noop outside render targets', () => {
    isRenderTargetMock.mockReturnValue(false);
    const { queryStarted } = installScene();

    const hold = holdRenderReadiness();
    expect(queryStarted).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    hold.release();
    expect(hold.released).toBe(true);
    expect(window.__grafanaRunningQueryCount).toBe(0);
  });

  it('is a noop without a scene', () => {
    isRenderTargetMock.mockReturnValue(true);
    const hold = holdRenderReadiness();
    expect(jest.getTimerCount()).toBe(0);
    expect(hold.released).toBe(false);
    expect(window.__grafanaRunningQueryCount).toBe(0);
  });
});
