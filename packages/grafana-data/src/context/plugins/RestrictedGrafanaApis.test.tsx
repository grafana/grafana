import { renderHook, RenderHookResult } from '@testing-library/react';

import {
  RestrictedGrafanaApisContextProvider,
  RestrictedGrafanaApisContextType,
  useRestrictedGrafanaApis,
} from './RestrictedGrafanaApis';

// Mock schema for testing
const mockAlertRuleFormSchema = {
  parse: jest.fn((data: unknown) => data),
  safeParse: jest.fn((data: unknown) => ({ success: true, data })),
};

describe('RestrictedGrafanaApis', () => {
  const apis: RestrictedGrafanaApisContextType = {
    alertingAlertRuleFormSchema: mockAlertRuleFormSchema,
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
          apiAllowList={{ alertingAlertRuleFormSchema: ['grafana-test-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.alertingAlertRuleFormSchema).toEqual(apis.alertingAlertRuleFormSchema);
    expect(Object.keys(result.current)).toEqual(['alertingAlertRuleFormSchema']);
  });

  it('should share an API if the plugin is allowed using a regexp', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiAllowList={{ alertingAlertRuleFormSchema: [/^grafana-/] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.alertingAlertRuleFormSchema).toEqual(apis.alertingAlertRuleFormSchema);
    expect(Object.keys(result.current)).toEqual(['alertingAlertRuleFormSchema']);
  });

  it('should not share an API if the plugin is not directly allowed and no allow regexp matches it', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'myorg-test-app'}
          apiAllowList={{ alertingAlertRuleFormSchema: [/^grafana-/] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.alertingAlertRuleFormSchema).not.toBeDefined();
  });

  // Ideally the `allowList` and the `blockList` are not used together
  it('should share an API if the plugin is both allowed and blocked (allow-list takes precendence)', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiAllowList={{ alertingAlertRuleFormSchema: ['grafana-test-app'] }}
          apiBlockList={{ alertingAlertRuleFormSchema: ['grafana-test-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.alertingAlertRuleFormSchema).toEqual(apis.alertingAlertRuleFormSchema);
    expect(Object.keys(result.current)).toEqual(['alertingAlertRuleFormSchema']);
  });

  it('should share an API with allowed plugins (testing multiple plugins)', () => {
    let result: RenderHookResult<RestrictedGrafanaApisContextType, unknown>;

    // 1. First app
    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiAllowList={{ alertingAlertRuleFormSchema: ['grafana-test-app', 'grafana-assistant-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.result.current.alertingAlertRuleFormSchema).toEqual(apis.alertingAlertRuleFormSchema);

    // 2. Second app
    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-assistant-app'}
          apiAllowList={{ alertingAlertRuleFormSchema: ['grafana-test-app', 'grafana-assistant-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.result.current.alertingAlertRuleFormSchema).toEqual(apis.alertingAlertRuleFormSchema);
  });

  it('should not share APIs with plugins that are not allowed', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-restricted-app'}
          apiAllowList={{ alertingAlertRuleFormSchema: ['grafana-authorised-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });

    expect(result.current.alertingAlertRuleFormSchema).not.toBeDefined();
  });

  it('should not share APIs with anyone if both the allowList and the blockList are empty', () => {
    let result: RenderHookResult<RestrictedGrafanaApisContextType, unknown>;

    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiAllowList={{ alertingAlertRuleFormSchema: [] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.result.current.alertingAlertRuleFormSchema).not.toBeDefined();

    result = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider apis={apis} pluginId={'grafana-test-app'}>
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.result.current.alertingAlertRuleFormSchema).not.toBeDefined();
  });

  it('should not share APIs with blocked plugins', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'grafana-test-app'}
          apiBlockList={{ alertingAlertRuleFormSchema: ['grafana-test-app'] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.current.alertingAlertRuleFormSchema).not.toBeDefined();
  });

  it('should not share APIs with plugins that match any block list regexes', () => {
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <RestrictedGrafanaApisContextProvider
          apis={apis}
          pluginId={'myorg-test-app'}
          apiBlockList={{ alertingAlertRuleFormSchema: [/^myorg-/] }}
        >
          {children}
        </RestrictedGrafanaApisContextProvider>
      ),
    });
    expect(result.current.alertingAlertRuleFormSchema).not.toBeDefined();
  });
});
