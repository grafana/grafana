import { renderHook } from '@testing-library/react';

import { locationService } from '@grafana/runtime';
import { useFlagAssistantAgentMode } from '@grafana/runtime/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { useAgentMode } from './useAgentMode';

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
  useFlagAssistantAgentMode: jest.fn(),
}));

jest.mock('app/core/context/GrafanaContext', () => ({
  useGrafana: jest.fn(),
}));

const useFlagMock = jest.mocked(useFlagAssistantAgentMode);
const useGrafanaMock = jest.mocked(useGrafana);
const getLocationMock = jest.mocked(locationService.getLocation);
const getLocationObservableMock = jest.mocked(locationService.getLocationObservable);
const partialMock = jest.mocked(locationService.partial);

const setAgentMode = jest.fn();

/** Build a full `Location` from just a search string (the only field the hook reads). */
function loc(search: string) {
  return { pathname: '/', search, hash: '', state: null, key: 'test' };
}

function mockChrome(agentMode = false) {
  useGrafanaMock.mockReturnValue({
    // The hook only uses chrome.useState() and chrome.setAgentMode().
    chrome: { useState: () => ({ agentMode }), setAgentMode },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe('useAgentMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLocationMock.mockReturnValue(loc(''));
    getLocationObservableMock.mockReturnValue({
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('reports the flag as disabled and stays inactive when the feature flag is off', () => {
    useFlagMock.mockReturnValue(false);
    mockChrome(true);

    const { result } = renderHook(() => useAgentMode());

    expect(result.current.agentModeFeatureFlagEnabled).toBe(false);
    // Even with chrome state on, active is gated by the flag.
    expect(result.current.active).toBe(false);
    // No location subscription is created while the flag is off.
    expect(getLocationObservableMock).not.toHaveBeenCalled();
    expect(setAgentMode).not.toHaveBeenCalled();
  });

  it('is active when the flag is on and chrome state has agent mode enabled', () => {
    useFlagMock.mockReturnValue(true);
    mockChrome(true);

    const { result } = renderHook(() => useAgentMode());

    expect(result.current.agentModeFeatureFlagEnabled).toBe(true);
    expect(result.current.active).toBe(true);
    expect(getLocationObservableMock).toHaveBeenCalled();
  });

  it('enters agent mode and clears the query param when the flag is on and ?agentMode=1 is present', () => {
    useFlagMock.mockReturnValue(true);
    mockChrome(false);
    getLocationMock.mockReturnValue(loc('?agentMode=1'));

    renderHook(() => useAgentMode());

    expect(setAgentMode).toHaveBeenCalledWith(true);
    expect(partialMock).toHaveBeenCalledWith({ agentMode: null });
  });

  it('does not enter agent mode when the query param is absent', () => {
    useFlagMock.mockReturnValue(true);
    mockChrome(false);
    getLocationMock.mockReturnValue(loc(''));

    renderHook(() => useAgentMode());

    expect(setAgentMode).not.toHaveBeenCalled();
  });

  it('unsubscribes from the location observable on unmount', () => {
    useFlagMock.mockReturnValue(true);
    mockChrome(false);
    const unsubscribe = jest.fn();
    getLocationObservableMock.mockReturnValue({
      subscribe: jest.fn(() => ({ unsubscribe })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { unmount } = renderHook(() => useAgentMode());
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
