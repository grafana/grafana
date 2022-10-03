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
  },
  queryEditor: {
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
    },
    metricName: {
      input: 'data-testid metric-name',
    },
  },
};

export const selectors: { components: E2ESelectors<typeof components> } = {
  components: components,
};
