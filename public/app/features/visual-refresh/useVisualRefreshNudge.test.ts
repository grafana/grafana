import { renderHook } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { config } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';

import { VisualRefreshFeedbackEvent } from './events';
import { useVisualRefreshNudge } from './useVisualRefreshNudge';

const TEN_MINUTES = 10 * 60 * 1000;

describe('useVisualRefreshNudge', () => {
  let publishSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    publishSpy = jest.spyOn(appEvents, 'publish');
    contextSrv.isSignedIn = true;
  });

  afterEach(() => {
    jest.useRealTimers();
    publishSpy.mockRestore();
  });

  it('publishes a nudge event after 10 minutes', () => {
    renderHook(() => useVisualRefreshNudge(true));

    jest.advanceTimersByTime(TEN_MINUTES - 1);
    expect(publishSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith(
      new VisualRefreshFeedbackEvent({ type: 'nudge', theme: config.theme2.name })
    );
  });

  it('does not publish when the visual refresh is disabled', () => {
    renderHook(() => useVisualRefreshNudge(false));
    jest.advanceTimersByTime(TEN_MINUTES);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('publishes the current theme when the nudge fires', () => {
    const originalTheme = config.theme2;
    try {
      config.theme2 = createTheme({ colors: { mode: 'dark' } });
      renderHook(() => useVisualRefreshNudge(true));

      config.theme2 = createTheme({ colors: { mode: 'light' } });
      jest.advanceTimersByTime(TEN_MINUTES);

      expect(publishSpy).toHaveBeenCalledWith(new VisualRefreshFeedbackEvent({ type: 'nudge', theme: 'Light' }));
    } finally {
      config.theme2 = originalTheme;
    }
  });

  it('does not publish when the user is signed out', () => {
    contextSrv.isSignedIn = false;
    renderHook(() => useVisualRefreshNudge(true));
    jest.advanceTimersByTime(TEN_MINUTES);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('does not publish after unmounting', () => {
    const { unmount } = renderHook(() => useVisualRefreshNudge(true));
    unmount();
    jest.advanceTimersByTime(TEN_MINUTES);
    expect(publishSpy).not.toHaveBeenCalled();
  });
});
