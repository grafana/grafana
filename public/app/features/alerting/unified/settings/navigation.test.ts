import { renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { addSettingsSection, clearSettingsExtensions } from './extensions';
import { useSettingsPageNav } from './navigation';

describe('useSettingsPageNav', () => {
  const mockNavIndex = {
    'alerting-admin': {
      id: 'alerting-admin',
      text: 'Settings',
      url: '/alerting/admin',
    },
  };

  const defaultPreloadedState = {
    navIndex: mockNavIndex,
  };

  it('should return settings page nav with alertmanager child when no extensions are present', () => {
    const wrapper = getWrapper({
      preloadedState: defaultPreloadedState,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/admin/alertmanager'],
      },
    });

    const { result } = renderHook(() => useSettingsPageNav(), { wrapper });

    expect(result.current.navId).toBe('alerting-admin');

    // Check the structure
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav.children).toHaveLength(1);
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav.children).toEqual([
      expect.objectContaining({
        id: 'alertmanager',
        text: 'Alert managers',
        url: '/alerting/admin/alertmanager',
        active: true,
        icon: 'cloud',
        parentItem: undefined,
      }),
    ]);
  });

  it('should include extensions when added via addSettingsSection', () => {
    // Clear any existing extensions
    clearSettingsExtensions();

    // Add two extensions
    addSettingsSection({
      id: 'enrichment',
      text: 'Enrichment',
      url: '/alerting/admin/enrichment',
      icon: 'star',
    });

    addSettingsSection({
      id: 'notifications',
      text: 'Notifications',
      url: '/alerting/admin/notifications',
      icon: 'bell',
    });

    const wrapper = getWrapper({
      preloadedState: defaultPreloadedState,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/admin/enrichment'],
      },
    });

    const { result } = renderHook(() => useSettingsPageNav(), { wrapper });

    expect(result.current.navId).toBe('alerting-admin');

    // Should have 3 children: alertmanager + 2 extensions
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav.children).toHaveLength(3);
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav.children).toEqual([
      expect.objectContaining({
        id: 'alertmanager',
        text: 'Alert managers',
        url: '/alerting/admin/alertmanager',
        active: false,
        icon: 'cloud',
        parentItem: undefined,
      }),
      expect.objectContaining({
        id: 'enrichment',
        text: 'Enrichment',
        url: '/alerting/admin/enrichment',
        active: true,
        icon: 'star',
        parentItem: undefined,
      }),
      expect.objectContaining({
        id: 'notifications',
        text: 'Notifications',
        url: '/alerting/admin/notifications',
        active: false,
        icon: 'bell',
        parentItem: undefined,
      }),
    ]);
  });
});
