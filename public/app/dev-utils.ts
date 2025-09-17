import { DEFAULT_LANGUAGE, PSEUDO_LOCALE } from '@grafana/i18n';
import store from 'app/core/store';

import { sendAppNotification } from './core/copy/appNotification';
import { PreferencesService } from './core/services/PreferencesService';
import { AppNotificationSeverity } from './types/appNotifications';

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
    const { default: worker } = await import('@grafana/test-utils/worker');

    // TODO: Generalise and move Alerting handlers into @grafana/test-utils or @grafana/alerting package
    const { default: alertingHandlers } = await import('./features/alerting/unified/mocks/server/all-handlers');
    worker.use(...alertingHandlers);

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

export const togglePseudoLocale = async () => {
  const prefsService = new PreferencesService('user');
  const prefs = await prefsService.load();

  const isPseudoEnabled = prefs.language === PSEUDO_LOCALE;

  const action = isPseudoEnabled ? 'Disabling' : 'Enabling';
  sendAppNotification(`${action} pseudo locale`, 'Reloading...', AppNotificationSeverity.Info);

  await prefsService.update({
    ...prefs,
    language: isPseudoEnabled ? DEFAULT_LANGUAGE : PSEUDO_LOCALE,
  });

  setTimeout(() => {
    window.location.reload();
  }, 200);
};
