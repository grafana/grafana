import { renderHook, RenderHookResult } from '@testing-library/react';

import { VizPanel } from '@grafana/scenes';

import {
  RestrictedGrafanaApisContextProvider,
  RestrictedGrafanaApisContextType,
  useRestrictedGrafanaApis,
} from './RestrictedGrafanaApis';

describe('RestrictedGrafanaApis', () => {
  const apis: RestrictedGrafanaApisContextType = {
    addPanel: (vizPanel: VizPanel) => {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should share an API if the plugin is whitelisted', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiWhitelist={{ addPanel: ['grafana-test-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.addPanel).toEqual(apis.addPanel);
    expect(Object.keys(result.current)).toEqual(['addPanel']);
  });

  it('should share an API if the plugin is whitelisted using a regexp', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiWhitelist={{ addPanel: [/^grafana-/] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.addPanel).toEqual(apis.addPanel);
    expect(Object.keys(result.current)).toEqual(['addPanel']);
  });

  it('should not share an API if the plugin is not directly whitelisted and no whitelist regexp matches it', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'myorg-test-app'}
          apiWhitelist={{ addPanel: [/^grafana-/] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.addPanel).not.toBeDefined();
  });

  // Ideally the whitelist and the blacklist are not used together
  it('should share an API if the plugin is both whitelisted and blacklisted (whitelisting takes precendence)', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiWhitelist={{ addPanel: ['grafana-test-app'] }}
          apiBlacklist={{ addPanel: ['grafana-test-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.addPanel).toEqual(apis.addPanel);
    expect(Object.keys(result.current)).toEqual(['addPanel']);
  });

  it('should share an API with whitelisted plugins (testing multiple plugins)', () => {
    let result: RenderHookResult<RestrictedGrafanaApisContextType, unknown>;

    // 1. First app
    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiWhitelist={{ addPanel: ['grafana-test-app', 'grafana-assistant-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.result.current.addPanel).toEqual(apis.addPanel);

    // 2. Second app
    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-assistant-app'}
          apiWhitelist={{ addPanel: ['grafana-test-app', 'grafana-assistant-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.result.current.addPanel).toEqual(apis.addPanel);
  });

  it('should not share APIs with plugins that are not whitelisted', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-restricted-app'}
          apiWhitelist={{ addPanel: ['grafana-authorised-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.addPanel).not.toBeDefined();
  });

  it('should not share APIs with anyone if both the whitelist and the blacklist are empty', () => {
    let result: RenderHookResult<RestrictedGrafanaApisContextType, unknown>;

    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider apis={apis} pluginId={'grafana-test-app'} apiWhitelist={{ addPanel: [] }}>
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.result.current.addPanel).not.toBeDefined();

    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider apis={apis} pluginId={'grafana-test-app'}>
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.result.current.addPanel).not.toBeDefined();
  });

  it('should not share APIs with blacklisted plugins', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiBlacklist={{ addPanel: ['grafana-test-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.current.addPanel).not.toBeDefined();
  });

  it('should not share APIs with plugins that match any blacklist regexes', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'myorg-test-app'}
          apiBlacklist={{ addPanel: [/^myorg-/] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.current.addPanel).not.toBeDefined();
  });
});
