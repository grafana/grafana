import { renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { addAlertRulesTab } from './extensions';
import { useAlertRulesNav } from './useAlertRulesNav';

const TabSuffix = () => null;

describe('useAlertRulesNav', () => {
  const originalFeatureToggles = config.featureToggles;

  const mockNavIndex = {
    'alert-rules': {
      id: 'alert-rules',
      text: 'Alert rules',
      url: '/alerting/list',
    },
  };
  const unregisterTabs: Array<() => void> = [];

  function registerAlertRulesTab(tab: Parameters<typeof addAlertRulesTab>[0]) {
    const unregisterTab = addAlertRulesTab(tab);
    unregisterTabs.push(unregisterTab);
    return unregisterTab;
  }

  // getWrapper only reads `store`, not `preloadedState`
  const getStore = () => configureStore({ navIndex: mockNavIndex });

  beforeEach(() => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: true };
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
    unregisterTabs.splice(0).forEach((unregisterTab) => unregisterTab());
  });

  it('should not show a tab bar when no extension tabs are registered', () => {
    const wrapper = getWrapper({
      store: getStore(),
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    expect(result.current.navId).toBe('alert-rules');
    expect(result.current.pageNav).toEqual(expect.objectContaining({ children: undefined }));
  });

  it('should include tabs registered via addAlertRulesTab', () => {
    registerAlertRulesTab({
      id: 'alert-rules-custom',
      text: 'Custom tab',
      url: '/alerting/list/custom',
      tabSuffix: TabSuffix,
    });

    const wrapper = getWrapper({
      store: getStore(),
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list/custom'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    expect(result.current.navId).toBe('alert-rules');
    expect(result.current.pageNav).toEqual(
      expect.objectContaining({
        children: [
          expect.objectContaining({
            id: 'alert-rules-list',
            url: '/alerting/list',
            active: false,
          }),
          expect.objectContaining({
            id: 'alert-rules-custom',
            text: 'Custom tab',
            url: '/alerting/list/custom',
            active: true,
            tabSuffix: TabSuffix,
            parentItem: mockNavIndex['alert-rules'],
          }),
        ],
      })
    );
  });

  it('should remove a registered tab when its unregister function is called', () => {
    const unregisterTab = registerAlertRulesTab({
      id: 'alert-rules-custom',
      text: 'Custom tab',
      url: '/alerting/list/custom',
    });
    unregisterTab();

    const wrapper = getWrapper({
      store: getStore(),
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    expect(result.current.pageNav).toEqual(expect.objectContaining({ children: undefined }));
  });

  it('should ignore registrations with a duplicate url', () => {
    registerAlertRulesTab({ id: 'first', text: 'First', url: '/alerting/list/custom' });
    registerAlertRulesTab({ id: 'second', text: 'Second', url: '/alerting/list/custom' });

    const wrapper = getWrapper({
      store: getStore(),
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    expect(result.current.pageNav).toEqual(
      expect.objectContaining({
        children: [
          expect.objectContaining({ id: 'alert-rules-list' }),
          expect.objectContaining({ id: 'first', text: 'First' }),
        ],
      })
    );
  });

  it('should return the legacy nav when alertingNavigationV2 is disabled', () => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };

    registerAlertRulesTab({ id: 'alert-rules-custom', text: 'Custom tab', url: '/alerting/list/custom' });

    const wrapper = getWrapper({
      store: getStore(),
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    expect(result.current).toEqual({ navId: 'alert-list' });
  });
});
