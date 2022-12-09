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
  },
  queryEditor: {
    header: {
      select: 'data-testid azure-monitor-experimental-header',
    },
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
        resource: {
          input: 'data-testid resource-picker-resource',
        },
      },
    },
    metricsQueryEditor: {
      metricName: {
        input: 'data-testid metric-name',
      },
    },
    logsQueryEditor: {
      formatSelection: {
        input: 'data-testid format-selection',
      },
    },
    argsQueryEditor: {
      container: {
        input: 'data-testid azure-monitor-arg-query-editor',
      },
      subscriptions: {
        input: 'data-testid azure-monitor-args-subscription',
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
  },
};

export const selectors: { components: E2ESelectors<typeof components> } = {
  components: components,
};
