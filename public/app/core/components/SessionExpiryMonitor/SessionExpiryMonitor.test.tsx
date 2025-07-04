import { render, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { contextSrv } from 'app/core/core';
import { appNotificationsReducer } from 'app/core/reducers/appNotification';
import { getSessionExpiry, hasSessionExpiry } from 'app/core/utils/auth';

import { SessionExpiryMonitor } from './SessionExpiryMonitor';

jest.mock('app/core/core', () => ({
  contextSrv: {
    isSignedIn: true,
  },
}));

jest.mock('app/core/utils/auth', () => ({
  getSessionExpiry: jest.fn(),
  hasSessionExpiry: jest.fn(),
}));

const mockWarning = jest.fn();
jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => ({
    warning: mockWarning,
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

const mockGetSessionExpiry = getSessionExpiry as jest.MockedFunction<typeof getSessionExpiry>;
const mockHasSessionExpiry = hasSessionExpiry as jest.MockedFunction<typeof hasSessionExpiry>;

describe('SessionExpiryMonitor', () => {
  let store: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    store = configureStore({
      reducer: {
        appNotifications: appNotificationsReducer,
      },
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderComponent = (props?: { warningMinutes?: number; checkIntervalMs?: number }) => {
    return render(
      <Provider store={store}>
        <SessionExpiryMonitor {...props} />
      </Provider>
    );
  };

  it('should not monitor session when user is not signed in', () => {
    (contextSrv as any).isSignedIn = false;
    mockHasSessionExpiry.mockReturnValue(true);

    renderComponent();

    expect(mockGetSessionExpiry).not.toHaveBeenCalled();
  });

  it('should not monitor session when session expiry is not available', () => {    
    (contextSrv as any).isSignedIn = true;
    mockHasSessionExpiry.mockReturnValue(false);

    renderComponent();

    expect(mockGetSessionExpiry).not.toHaveBeenCalled();
  });

  it('should show warning when session is about to expire', async () => {
    
    (contextSrv as any).isSignedIn = true;
    mockHasSessionExpiry.mockReturnValue(true);
    
    const now = Date.now();
    const expiryTime = Math.floor((now + 4 * 60 * 1000) / 1000); // 4 minutes from now
    mockGetSessionExpiry.mockReturnValue(expiryTime);

    renderComponent({ warningMinutes: 5, checkIntervalMs: 1000 });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockWarning).toHaveBeenCalledWith(
        'Session Expiring Soon',
        expect.stringContaining('Your session will expire in')
      );
    });
  });

  it('should not show warning when session is not close to expiry', async () => {
    (contextSrv as any).isSignedIn = true;
    mockHasSessionExpiry.mockReturnValue(true);
    
    const now = Date.now();
    const expiryTime = Math.floor((now + 10 * 60 * 1000) / 1000); // 10 minutes from now
    mockGetSessionExpiry.mockReturnValue(expiryTime);

    renderComponent({ warningMinutes: 5, checkIntervalMs: 1000 });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockWarning).not.toHaveBeenCalled();
    });
  });

  it('should not show warning again after already showing it', async () => {
    (contextSrv as any).isSignedIn = true;
    mockHasSessionExpiry.mockReturnValue(true);
    
    const now = Date.now();
    const expiryTime = Math.floor((now + 4 * 60 * 1000) / 1000); // 4 minutes from now
    mockGetSessionExpiry.mockReturnValue(expiryTime);

    renderComponent({ warningMinutes: 5, checkIntervalMs: 1000 });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockWarning).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockWarning).toHaveBeenCalledTimes(1);
  });

  it('should clean up interval on unmount', () => {
    (contextSrv as any).isSignedIn = true;
    mockHasSessionExpiry.mockReturnValue(true);
    mockGetSessionExpiry.mockReturnValue(Math.floor((Date.now() + 10 * 60 * 1000) / 1000));
    
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderComponent();
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    
    clearIntervalSpy.mockRestore();
  });
});
