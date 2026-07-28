import { renderHook } from '@testing-library/react';

import { locationService } from '@grafana/runtime';
import { useFlagAssistantFullscreenWorkspace } from '@grafana/runtime/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { useFullscreenWorkspace } from './useFullscreenWorkspace';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    locationService: {
      getLocation: jest.fn(() => ({ search: '' })),
      getLocationObservable: jest.fn(() => ({ subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })) })),
      partial: jest.fn(),
    },
  };
});

jest.mock('@grafana/runtime/internal', () => ({
  useFlagAssistantFullscreenWorkspace: jest.fn(),
}));

jest.mock('app/core/context/GrafanaContext', () => ({
  useGrafana: jest.fn(),
}));

const useFlagMock = jest.mocked(useFlagAssistantFullscreenWorkspace);
const useGrafanaMock = jest.mocked(useGrafana);
const getLocationMock = jest.mocked(locationService.getLocation);
const getLocationObservableMock = jest.mocked(locationService.getLocationObservable);
const partialMock = jest.mocked(locationService.partial);

const setFullscreenWorkspace = jest.fn();

/** Build a full `Location` from just a search string (the only field the hook reads). */
function loc(search: string) {
  return { pathname: '/', search, hash: '', state: null, key: 'test' };
}

function mockChrome(fullscreenWorkspace = false) {
  useGrafanaMock.mockReturnValue({
    // The hook only uses chrome.useState() and chrome.setFullscreenWorkspace().
    chrome: { useState: () => ({ fullscreenWorkspace }), setFullscreenWorkspace },
  } as unknown as ReturnType<typeof useGrafana>);
}

describe('useFullscreenWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLocationMock.mockReturnValue(loc(''));
    getLocationObservableMock.mockReturnValue({
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    } as unknown as ReturnType<typeof locationService.getLocationObservable>);
  });

  it('reports the flag as disabled and stays inactive when the feature flag is off', () => {
    useFlagMock.mockReturnValue(false);
    mockChrome(true);

    const { result } = renderHook(() => useFullscreenWorkspace());

    expect(result.current.fullscreenWorkspaceFeatureFlagEnabled).toBe(false);
    // Even with chrome state on, active is gated by the flag.
    expect(result.current.fullscreenWorkspaceActive).toBe(false);
    // No location subscription is created while the flag is off.
    expect(getLocationObservableMock).not.toHaveBeenCalled();
    expect(setFullscreenWorkspace).not.toHaveBeenCalled();
  });

  it('is active when the flag is on and chrome state has fullscreen workspace enabled', () => {
    useFlagMock.mockReturnValue(true);
    mockChrome(true);

    const { result } = renderHook(() => useFullscreenWorkspace());

    expect(result.current.fullscreenWorkspaceFeatureFlagEnabled).toBe(true);
    expect(result.current.fullscreenWorkspaceActive).toBe(true);
    expect(getLocationObservableMock).toHaveBeenCalled();
  });

  it('enters fullscreen workspace and clears the query param when the flag is on and ?fullscreenWorkspace=1 is present', () => {
    useFlagMock.mockReturnValue(true);
    mockChrome(false);
    getLocationMock.mockReturnValue(loc('?fullscreenWorkspace=1'));

    renderHook(() => useFullscreenWorkspace());

    expect(setFullscreenWorkspace).toHaveBeenCalledWith(true);
    expect(partialMock).toHaveBeenCalledWith({ fullscreenWorkspace: null });
  });

  it('does not enter fullscreen workspace when the query param is absent', () => {
    useFlagMock.mockReturnValue(true);
    mockChrome(false);
    getLocationMock.mockReturnValue(loc(''));

    renderHook(() => useFullscreenWorkspace());

    expect(setFullscreenWorkspace).not.toHaveBeenCalled();
  });

  it('unsubscribes from the location observable on unmount', () => {
    useFlagMock.mockReturnValue(true);
    mockChrome(false);
    const unsubscribe = jest.fn();
    getLocationObservableMock.mockReturnValue({
      subscribe: jest.fn(() => ({ unsubscribe })),
    } as unknown as ReturnType<typeof locationService.getLocationObservable>);

    const { unmount } = renderHook(() => useFullscreenWorkspace());
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
