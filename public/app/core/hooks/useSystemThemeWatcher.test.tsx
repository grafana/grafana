import { render, cleanup } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { config, ThemeChangedEvent } from '@grafana/runtime';

import { appEvents } from '../app_events';
import { contextSrv } from '../services/context_srv';
import { changeTheme } from '../services/theme';

import { useSystemThemeWatcher } from './useSystemThemeWatcher';

jest.mock('../services/theme', () => ({
  changeTheme: jest.fn(),
}));

jest.mock('../services/context_srv', () => ({
  contextSrv: {
    user: {
      theme: 'system',
    },
  },
}));

const TestComponent = () => {
  useSystemThemeWatcher();
  return null;
};

describe('useSystemThemeWatcher', () => {
  let matchMediaMock: jest.Mock;
  let listeners: Record<string, Function> = {};

  beforeEach(() => {
    listeners = {};
    jest.clearAllMocks();

    matchMediaMock = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn((event, cb) => {
        listeners[event] = cb;
      }),
      removeEventListener: jest.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });

    config.theme2 = createTheme({ colors: { mode: 'light' } });
    contextSrv.user.theme = 'system';
  });

  afterEach(() => {
    cleanup();
  });

  it('should call changeTheme when system theme changes', () => {
    render(<TestComponent />);

    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)');

    // Simulate system change to dark
    const handler = listeners['change'];
    expect(handler).toBeDefined();

    handler({ matches: true });

    expect(changeTheme).toHaveBeenCalledWith('dark', true);
  });

  it('should NOT call changeTheme if user has overridden theme', () => {
    contextSrv.user.theme = 'light';
    render(<TestComponent />);

    expect(matchMediaMock).not.toHaveBeenCalled();
  });

  it('should re-attach listener if theme changes back to system', () => {
    // 1. Start with override
    contextSrv.user.theme = 'light';
    render(<TestComponent />);
    expect(matchMediaMock).not.toHaveBeenCalled();

    // 2. Change preference to system
    contextSrv.user.theme = 'system';

    // 3. Publish event to trigger re-eval
    appEvents.publish(new ThemeChangedEvent(createTheme({ colors: { mode: 'light' } })));

    // 4. Now listener should be attached
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });
});
