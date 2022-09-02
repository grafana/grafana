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
  queryEditor: {},
};

export const selectors: { components: E2ESelectors<typeof components> } = {
  components: components,
};
