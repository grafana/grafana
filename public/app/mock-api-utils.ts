import store from 'app/core/store';

import { sendAppNotification } from './core/copy/appNotification';
import { AppNotificationSeverity } from './types';

export const STORAGE_MOCK_API_KEY = 'grafana.dev.mockApi';

export const currentMockApiState = () => {
  return store.getBool(STORAGE_MOCK_API_KEY, false);
};

export const toggleMockApiAndReload = () => {
  const currentState = currentMockApiState();
  store.set(STORAGE_MOCK_API_KEY, String(!currentState));
  const action = currentState ? 'Disabling' : 'Enabling';
  sendAppNotification(`${action} Mock API`, 'Reloading...', AppNotificationSeverity.Info);
  setTimeout(() => {
    window.location.reload();
  }, 200);
};

export const potentiallySetupMockApi = async () => {
  const mockApiEnabled = currentMockApiState();
  if (process.env.NODE_ENV === 'development' && mockApiEnabled) {
    const { default: worker } = await import('test/mock-api/worker');

    worker.start({ onUnhandledRequest: 'bypass' });
  }
};

export const notifyIfMockApiEnabled = () => {
  if (process.env.NODE_ENV === 'development' && currentMockApiState()) {
    sendAppNotification(
      'Mock API currently enabled',
      'Some network requests will be intercepted',
      AppNotificationSeverity.Info
    );
  }
};
