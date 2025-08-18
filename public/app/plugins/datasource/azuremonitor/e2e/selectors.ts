import { E2ESelectors } from '@grafana/e2e-selectors';

export const components = {
  configEditor: {
    authType: {
      select: 'data-testid auth-type',
    },
    azureCloud: {
      input: 'data-testid azure-cloud',
    },
    tenantID: {
      input: 'data-testid tenant-id',
    },
    clientID: {
      input: 'data-testid client-id',
    },
    clientSecret: {
      input: 'data-testid client-secret',
    },
    loadSubscriptions: {
      button: 'data-testid load-subscriptions',
    },
    defaultSubscription: {
      input: 'data-testid default-subscription',
    },
    serviceCredentialsEnabled: {
      button: 'data-testid service-credentials-enabled',
    },
  },
  queryEditor: {
    header: {
      select: 'data-testid azure-monitor-experimental-header',
    },
    userAuthAlert: 'data-testid azure-monitor-user-auth-invalid-auth-provider-alert',
    userAuthFallbackAlert: 'data-testid azure-monitor-user-auth-fallback-alert',
    resourcePicker: {
      select: {
        button: 'data-testid resource-picker-select',
      },
      search: {
        input: 'data-testid resource-picker-search',
      },
      apply: {
        button: 'data-testid resource-picker-apply',
      },
      cancel: {
        button: 'data-testid resource-picker-cancel',
      },
      advanced: {
        collapse: 'data-testid resource-picker-advanced',
        subscription: {
          input: 'data-testid resource-picker-subscription',
        },
        resourceGroup: {
          input: 'data-testid resource-picker-resource-group',
        },
        namespace: {
          input: 'data-testid resource-picker-namespace',
        },
        region: {
          input: 'data-testid resource-picker-region',
        },
        resource: {
          input: 'data-testid resource-picker-resource',
        },
      },
    },
    metricsQueryEditor: {
      container: { input: 'data-testid azure-monitor-metrics-query-editor-with-experimental-ui' },
      metricName: {
        input: 'data-testid metric-name',
      },
    },
    logsQueryEditor: {
      container: { input: 'data-testid azure-monitor-logs-query-editor-with-experimental-ui' },
      formatSelection: {
        input: 'data-testid format-selection',
      },
      runQuery: {
        button: 'data-testid run-query',
      },
    },
    logsQueryBuilder: {
      container: { input: 'data-testid azure-monitor-logs-query-builder' },
    },
    argsQueryEditor: {
      container: {
        input: 'data-testid azure-monitor-arg-query-editor',
      },
      subscriptions: {
        input: 'data-testid azure-monitor-args-subscription',
      },
    },
    tracesQueryEditor: {
      container: {
        input: 'data-testid azure-monitor-traces-query-editor-with-experimental-ui',
      },
      traceTypes: {
        select: 'data-testid azure-monitor-traces-query-editor-trace-types',
      },
    },
  },
  variableEditor: {
    queryType: {
      input: 'data-testid query-type',
    },
    subscription: {
      input: 'data-testid subscription',
    },
    resourceGroup: {
      input: 'data-testid resource-group',
    },
    namespace: {
      input: 'data-testid namespace',
    },
    resource: {
      input: 'data-testid resource',
    },
    region: {
      input: 'data-testid region',
    },
    customNamespace: {
      input: 'data-testid custom-namespace',
    },
  },
};

export const selectors: { components: E2ESelectors<typeof components> } = {
  components: components,
};
