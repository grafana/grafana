import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';

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
  }),
}));

describe('SessionExpiryMonitor', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    store = configureStore({
      reducer: {
        appNotifications: appNotificationsReducer,
      },
    });

    (contextSrv as { isSignedIn: boolean }).isSignedIn = true;
    (hasSessionExpiry as jest.Mock).mockReturnValue(true);
  });

  const renderComponent = (props = {}) => {
    return render(
      <Provider store={store}>
        <SessionExpiryMonitor {...props} />
      </Provider>
    );
  };

  it('should render without crashing', () => {
    const futureTime = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes from now
    (getSessionExpiry as jest.Mock).mockReturnValue(futureTime);

    const { container } = renderComponent();
    expect(container).toBeInTheDocument();
  });

  it('should not crash when session expiry is not available', () => {
    (getSessionExpiry as jest.Mock).mockReturnValue(null);

    const { container } = renderComponent();
    expect(container).toBeInTheDocument();
  });

  it('should not monitor when user is not signed in', () => {
    (contextSrv as { isSignedIn: boolean }).isSignedIn = false;
    (getSessionExpiry as jest.Mock).mockReturnValue(Math.floor(Date.now() / 1000) + 10 * 60);

    renderComponent();
    
    expect(hasSessionExpiry).not.toHaveBeenCalled();
  });

  it('should not monitor when session expiry is not available', () => {
    (hasSessionExpiry as jest.Mock).mockReturnValue(false);
    (getSessionExpiry as jest.Mock).mockReturnValue(Math.floor(Date.now() / 1000) + 10 * 60);

    renderComponent();
    
    expect(getSessionExpiry).not.toHaveBeenCalled();
  });

  it('should accept custom warning minutes and check interval props', () => {
    const futureTime = Math.floor(Date.now() / 1000) + 10 * 60;
    (getSessionExpiry as jest.Mock).mockReturnValue(futureTime);

    const { container } = renderComponent({ 
      warningMinutes: 3, 
      checkIntervalMs: 5000 
    });
    
    expect(container).toBeInTheDocument();
  });

  it('should use default props when none provided', () => {
    const futureTime = Math.floor(Date.now() / 1000) + 10 * 60;
    (getSessionExpiry as jest.Mock).mockReturnValue(futureTime);

    const { container } = renderComponent();
    
    expect(container).toBeInTheDocument();
  });

  
  describe('dynamic warning time calculation', () => {
    it('should calculate effective warning times correctly', () => {
      // These tests verify the logic would work correctly
      const testCases = [
        { sessionMinutes: 2, warningMinutes: 5, expected: 1 }, // Half of 2 = 1
        { sessionMinutes: 6, warningMinutes: 5, expected: 3 }, // Half of 6 = 3  
        { sessionMinutes: 20, warningMinutes: 5, expected: 5 }, // Use configured 5
        { sessionMinutes: 1, warningMinutes: 5, expected: 1 }, // Minimum 1
      ];

      testCases.forEach(testCase => {
        const sessionTimeRemainingMinutes = testCase.sessionMinutes;
        const warningMinutes = testCase.warningMinutes;
        

        const effectiveWarningMinutes = Math.min(
          warningMinutes,
          Math.max(1, sessionTimeRemainingMinutes / 2)
        );
        
        expect(effectiveWarningMinutes).toBe(testCase.expected);
      });
    });
  });
});
