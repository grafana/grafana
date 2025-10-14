import { act, render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { AppEvents, PageLayoutType } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { configureStore } from 'app/store/configureStore';
import { KioskMode } from 'app/types/dashboard';

import { AppChromeState } from '../AppChrome/AppChromeService';

import { AppNotificationList } from './AppNotificationList';

describe('AppNotificationList', () => {
  const renderWithContext = (kioskMode?: KioskMode, pathname = '/') => {
    const mockStore = configureStore(); // Fresh store for each test
    const contextMock = getGrafanaContextMock();

    // Replace chrome.state.getValue with a function that returns the kioskMode
    const mockState: AppChromeState = {
      chromeless: false,
      sectionNav: { node: { text: '' }, main: { text: '' } },
      megaMenuOpen: false,
      megaMenuDocked: false,
      kioskMode: kioskMode ?? null,
      layout: PageLayoutType.Standard,
    };
    contextMock.chrome.state.getValue = () => mockState;

    return {
      ...render(
        <Provider store={mockStore}>
          <GrafanaContext.Provider value={contextMock}>
            <MemoryRouter initialEntries={[pathname]}>
              <AppNotificationList />
            </MemoryRouter>
          </GrafanaContext.Provider>
        </Provider>
      ),
      contextMock,
      mockStore,
    };
  };

  describe('Error notifications', () => {
    it('should show error notifications when not in kiosk mode', async () => {
      const { container } = renderWithContext(undefined, '/d/test-dashboard');

      await act(async () => {
        appEvents.emit(AppEvents.alertError, ['Test error']);
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Test error');
      });
    });

    it('should hide error notifications in kiosk mode on dashboard page', async () => {
      const { container } = renderWithContext(KioskMode.Full, '/d/test-dashboard');

      await act(async () => {
        appEvents.emit(AppEvents.alertError, ['Test error']);
      });

      // Wait a bit to ensure event handlers have run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(container.textContent).not.toContain('Test error');
    });

    it('should show error notifications in kiosk mode on non-dashboard pages', async () => {
      const { container } = renderWithContext(KioskMode.Full, '/alerting');

      await act(async () => {
        appEvents.emit(AppEvents.alertError, ['Test error']);
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Test error');
      });
    });

    it('should hide error notifications in kiosk mode on home dashboard', async () => {
      const { container } = renderWithContext(KioskMode.Full, '/d/');

      await act(async () => {
        appEvents.emit(AppEvents.alertError, ['Test error']);
      });

      // Wait a bit to ensure event handlers have run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(container.textContent).not.toContain('Test error');
    });

    it('should show error notifications in kiosk mode on root page (not dashboard route)', async () => {
      const { container } = renderWithContext(KioskMode.Full, '/');

      await act(async () => {
        appEvents.emit(AppEvents.alertError, ['Test error']);
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Test error');
      });
    });
  });

  describe('Other notification types', () => {
    it('should always show success notifications in kiosk mode on dashboard', async () => {
      const { container } = renderWithContext(KioskMode.Full, '/d/test-dashboard');

      await act(async () => {
        appEvents.emit(AppEvents.alertSuccess, ['Test success']);
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Test success');
      });
    });

    it('should always show warning notifications in kiosk mode on dashboard', async () => {
      const { container } = renderWithContext(KioskMode.Full, '/d/test-dashboard');

      await act(async () => {
        appEvents.emit(AppEvents.alertWarning, ['Test warning']);
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Test warning');
      });
    });

    it('should always show info notifications in kiosk mode on dashboard', async () => {
      const { container } = renderWithContext(KioskMode.Full, '/d/test-dashboard');

      await act(async () => {
        appEvents.emit(AppEvents.alertInfo, ['Test info']);
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Test info');
      });
    });
  });

  describe('Edge cases', () => {
    it('should show error on dashboard page with uid and slug', async () => {
      const { container } = renderWithContext(undefined, '/d/test-uid/test-slug');

      await act(async () => {
        appEvents.emit(AppEvents.alertError, ['Test error']);
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Test error');
      });
    });

    it('should hide error in kiosk mode on dashboard page with uid and slug', async () => {
      const { container } = renderWithContext(KioskMode.Full, '/d/test-uid/test-slug');

      await act(async () => {
        appEvents.emit(AppEvents.alertError, ['Test error']);
      });

      // Wait a bit to ensure event handlers have run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(container.textContent).not.toContain('Test error');
    });

    it('should show error on legacy dashboard route', async () => {
      const { container } = renderWithContext(KioskMode.Full, '/dashboard/db/test-dashboard');

      await act(async () => {
        appEvents.emit(AppEvents.alertError, ['Test error']);
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Test error');
      });
    });
  });
});

