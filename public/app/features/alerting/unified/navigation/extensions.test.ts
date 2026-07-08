import { renderHook } from '@testing-library/react';
import { getWrapper, testWithFeatureToggles } from 'test/test-utils';

import { configureStore } from 'app/store/configureStore';

import { addAlertRulesTab, clearAlertRulesNavExtensions } from './extensions';
import { useAlertRulesNav } from './useAlertRulesNav';

describe('useAlertRulesNav extensions', () => {
  testWithFeatureToggles({ enable: ['alertingNavigationV2'] });

  const mockNavIndex = {
    'alert-rules': {
      id: 'alert-rules',
      text: 'Alert rules',
      url: '/alerting/list',
    },
  };

  const defaultPreloadedState = {
    navIndex: mockNavIndex,
  };

  beforeEach(() => {
    clearAlertRulesNavExtensions();
  });

  it('should not render a tab bar when no extensions are registered', () => {
    const wrapper = getWrapper({
      store: configureStore(defaultPreloadedState),
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    expect(result.current.navId).toBe('alert-rules');
    // With only the built-in list tab, no children are rendered (no tab bar)
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children).toBeUndefined();
  });

  it('should include extension tabs registered via addAlertRulesTab', () => {
    addAlertRulesTab({
      id: 'alert-rules-extension',
      text: 'Extension tab',
      url: '/alerting/list/extension',
    });

    const wrapper = getWrapper({
      store: configureStore(defaultPreloadedState),
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list/extension'],
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
        id: 'alert-rules-extension',
        text: 'Extension tab',
        url: '/alerting/list/extension',
        active: true,
      }),
    ]);
  });

  it('should warn and ignore a second extension registered for the same url', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    addAlertRulesTab({ id: 'first', text: 'First', url: '/alerting/list/extension' });
    addAlertRulesTab({ id: 'second', text: 'Second', url: '/alerting/list/extension' });

    const wrapper = getWrapper({
      store: configureStore(defaultPreloadedState),
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    const children = result.current.pageNav?.children ?? [];
    expect(children).toHaveLength(2);
    expect(children[1]).toEqual(expect.objectContaining({ id: 'first' }));
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
