import { renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { addAlertRulesTab, clearAlertRulesTabExtensions } from './extensions';
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

  // getWrapper only reads `store`, not `preloadedState`
  const getStore = () => configureStore({ navIndex: mockNavIndex });

  beforeEach(() => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: true };
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
    clearAlertRulesTabExtensions();
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
    // A single tab means no tab bar is rendered
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children).toBeUndefined();
  });

  it('should include tabs registered via addAlertRulesTab', () => {
    addAlertRulesTab({
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
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children).toEqual([
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
    ]);
  });

  it('should ignore registrations with a duplicate url', () => {
    addAlertRulesTab({ id: 'first', text: 'First', url: '/alerting/list/custom' });
    addAlertRulesTab({ id: 'second', text: 'Second', url: '/alerting/list/custom' });

    const wrapper = getWrapper({
      store: getStore(),
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    const children = result.current.pageNav?.children ?? [];
    expect(children).toHaveLength(2);
    expect(children[1]).toEqual(expect.objectContaining({ id: 'first', text: 'First' }));
  });

  it('should return the legacy nav when alertingNavigationV2 is disabled', () => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };

    addAlertRulesTab({ id: 'alert-rules-custom', text: 'Custom tab', url: '/alerting/list/custom' });

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
