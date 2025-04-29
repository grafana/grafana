import { sendAppNotification } from './core/copy/appNotification';
import { AppNotificationSeverity } from './types';

export const STORAGE_MOCK_API_KEY = 'grafana.dev.mockApi';

export const currentMockApiState = () => {
  return window.localStorage.getItem(STORAGE_MOCK_API_KEY) === 'true';
};

export const toggleMockApiAndReload = () => {
  const currentState = currentMockApiState();
  window.localStorage.setItem(STORAGE_MOCK_API_KEY, String(!currentState));
  sendAppNotification(`Toggling Mock API`, 'Reloading...', AppNotificationSeverity.Info);
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
  return Promise.resolve();
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
