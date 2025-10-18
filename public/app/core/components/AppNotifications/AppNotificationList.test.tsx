import { act, getWrapper, render, screen } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { KioskMode } from 'app/types/dashboard';

import { AppChromeService } from '../AppChrome/AppChromeService';

import { AppNotificationList } from './AppNotificationList';

const renderWithContext = (kioskMode?: KioskMode, pathname = '/') => {
  const chromeService = new AppChromeService();
  if (kioskMode) {
    chromeService.update({ kioskMode });
  }

  const wrapper = getWrapper({
    renderWithRouter: true,
    historyOptions: { initialEntries: [pathname] },
    grafanaContext: {
      chrome: chromeService,
    },
  });
  const view = render(<AppNotificationList />, { wrapper });

  return view;
};

const expectedErrorMessage = 'Test error';
const expectedSuccessMessage = 'Test success';
const expectedWarningMessage = 'Test warning';
const expectedInfoMessage = 'Test info';

const sendTestNotification = async (type: (typeof AppEvents)[keyof typeof AppEvents], message: string) => {
  return act(async () => {
    appEvents.publish({ type: type.name, payload: [message] });
  });
};

describe('AppNotificationList', () => {
  describe('Error notifications', () => {
    it('should show error notifications when not in kiosk mode', async () => {
      renderWithContext(undefined, '/d/test-dashboard');
      await sendTestNotification(AppEvents.alertError, expectedErrorMessage);

      expect(await screen.findByText(expectedErrorMessage)).toBeInTheDocument();
    });

    it('should hide error notifications in kiosk mode on dashboard page', async () => {
      renderWithContext(KioskMode.Full, '/d/test-dashboard');
      await sendTestNotification(AppEvents.alertError, expectedErrorMessage);

      expect(screen.queryByText(expectedErrorMessage)).not.toBeInTheDocument();
    });

    it('should show error notifications in kiosk mode on non-dashboard pages', async () => {
      renderWithContext(KioskMode.Full, '/alerting');
      await sendTestNotification(AppEvents.alertError, expectedErrorMessage);

      expect(await screen.findByText(expectedErrorMessage)).toBeInTheDocument();
    });

    it('should hide error notifications in kiosk mode on home dashboard', async () => {
      renderWithContext(KioskMode.Full, '/d/');
      await sendTestNotification(AppEvents.alertError, expectedErrorMessage);

      expect(screen.queryByText(expectedErrorMessage)).not.toBeInTheDocument();
    });

    it('should show error notifications in kiosk mode on root page (not dashboard route)', async () => {
      renderWithContext(KioskMode.Full, '/');
      await sendTestNotification(AppEvents.alertError, expectedErrorMessage);

      expect(await screen.findByText(expectedErrorMessage)).toBeInTheDocument();
    });
  });

  describe('Other notification types', () => {
    it('should always show success notifications in kiosk mode on dashboard', async () => {
      renderWithContext(KioskMode.Full, '/d/test-dashboard');
      await sendTestNotification(AppEvents.alertSuccess, expectedSuccessMessage);

      expect(await screen.findByText(expectedSuccessMessage)).toBeInTheDocument();
    });

    it('should always show warning notifications in kiosk mode on dashboard', async () => {
      renderWithContext(KioskMode.Full, '/d/test-dashboard');
      await sendTestNotification(AppEvents.alertWarning, expectedWarningMessage);

      expect(await screen.findByText(expectedWarningMessage)).toBeInTheDocument();
    });

    it('should always show info notifications in kiosk mode on dashboard', async () => {
      renderWithContext(KioskMode.Full, '/d/test-dashboard');
      await sendTestNotification(AppEvents.alertInfo, expectedInfoMessage);

      expect(await screen.findByText(expectedInfoMessage)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should show error on dashboard page with uid and slug', async () => {
      renderWithContext(undefined, '/d/test-uid/test-slug');
      await sendTestNotification(AppEvents.alertError, expectedErrorMessage);

      expect(await screen.findByText(expectedErrorMessage)).toBeInTheDocument();
    });

    it('should hide error in kiosk mode on dashboard page with uid and slug', async () => {
      renderWithContext(KioskMode.Full, '/d/test-uid/test-slug');
      await sendTestNotification(AppEvents.alertError, expectedErrorMessage);

      expect(screen.queryByText(expectedErrorMessage)).not.toBeInTheDocument();
    });

    it('should show error on legacy dashboard route', async () => {
      renderWithContext(KioskMode.Full, '/dashboard/db/test-dashboard');
      await sendTestNotification(AppEvents.alertError, expectedErrorMessage);

      expect(await screen.findByText(expectedErrorMessage)).toBeInTheDocument();
    });
  });
});
