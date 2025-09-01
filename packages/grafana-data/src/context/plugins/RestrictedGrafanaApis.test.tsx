import { renderHook, RenderHookResult } from '@testing-library/react';

import {
  RestrictedGrafanaApisContextProvider,
  RestrictedGrafanaApisContextType,
  useRestrictedGrafanaApis,
} from './RestrictedGrafanaApis';

describe('RestrictedGrafanaApis', () => {
  const apis: RestrictedGrafanaApisContextType = {
    addPanel: () => {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should share an API if the plugin is allowed', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiAllowList={{ addPanel: ['grafana-test-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    // @ts-expect-error No APIs are defined yet
    expect(result.current.addPanel).toEqual(apis.addPanel);
    expect(Object.keys(result.current)).toEqual(['addPanel']);
  });

  it('should share an API if the plugin is allowed using a regexp', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiAllowList={{ addPanel: [/^grafana-/] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    // @ts-expect-error No APIs are defined yet
    expect(result.current.addPanel).toEqual(apis.addPanel);
    expect(Object.keys(result.current)).toEqual(['addPanel']);
  });

  it('should not share an API if the plugin is not directly allowed and no allow regexp matches it', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'myorg-test-app'}
          apiAllowList={{ addPanel: [/^grafana-/] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    // @ts-expect-error No APIs are defined yet
    expect(result.current.addPanel).not.toBeDefined();
  });

  // Ideally the `allowList` and the `blockList` are not used together
  it('should share an API if the plugin is both allowed and blocked (allow-list takes precendence)', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiAllowList={{ addPanel: ['grafana-test-app'] }}
          apiBlockList={{ addPanel: ['grafana-test-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    // @ts-expect-error No APIs are defined yet
    expect(result.current.addPanel).toEqual(apis.addPanel);
    expect(Object.keys(result.current)).toEqual(['addPanel']);
  });

  it('should share an API with allowed plugins (testing multiple plugins)', () => {
    let result: RenderHookResult<RestrictedGrafanaApisContextType, unknown>;

    // 1. First app
    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiAllowList={{ addPanel: ['grafana-test-app', 'grafana-assistant-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    // @ts-expect-error No APIs are defined yet
    expect(result.result.current.addPanel).toEqual(apis.addPanel);

    // 2. Second app
    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-assistant-app'}
          apiAllowList={{ addPanel: ['grafana-test-app', 'grafana-assistant-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    // @ts-expect-error No APIs are defined yet
    expect(result.result.current.addPanel).toEqual(apis.addPanel);
  });

  it('should not share APIs with plugins that are not allowed', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-restricted-app'}
          apiAllowList={{ addPanel: ['grafana-authorised-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    // @ts-expect-error No APIs are defined yet
    expect(result.current.addPanel).not.toBeDefined();
  });

  it('should not share APIs with anyone if both the allowList and the blockList are empty', () => {
    let result: RenderHookResult<RestrictedGrafanaApisContextType, unknown>;

    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider apis={apis} pluginId={'grafana-test-app'} apiAllowList={{ addPanel: [] }}>
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    // @ts-expect-error No APIs are defined yet
    expect(result.result.current.addPanel).not.toBeDefined();

    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider apis={apis} pluginId={'grafana-test-app'}>
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    // @ts-expect-error No APIs are defined yet
    expect(result.result.current.addPanel).not.toBeDefined();
  });

  it('should not share APIs with blocked plugins', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiBlockList={{ addPanel: ['grafana-test-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    // @ts-expect-error No APIs are defined yet
    expect(result.current.addPanel).not.toBeDefined();
  });

  it('should not share APIs with plugins that match any block list regexes', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'myorg-test-app'}
          apiBlockList={{ addPanel: [/^myorg-/] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    // @ts-expect-error No APIs are defined yet
    expect(result.current.addPanel).not.toBeDefined();
  });
});
