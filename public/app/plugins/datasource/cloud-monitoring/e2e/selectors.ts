import { E2ESelectors } from '@grafana/e2e-selectors';

export const components = {
  queryEditor: {
    container: 'data-testid cloud-monitoring-query-editor',
    header: {
      select: 'data-testid cloud-monitoring-header',
    },
    visualMetricsQueryEditor: {
      container: { input: 'data-testid cloud-monitoring-visual-metrics-query-editor' },
    },
    mqlMetricsQueryEditor: {
      container: { input: 'data-testid cloud-monitoring-mql-query-editor' },
    },
    sloQueryEditor: {
      container: {
        input: 'data-testid cloud-monitoring-slo-query-editor',
      },
    },
    promQlQueryEditor: {
      container: {
        input: 'data-testid cloud-monitoring-prom-ql-query-editor',
      },
    },
  },
};

export const selectors: { components: E2ESelectors<typeof components> } = {
  components: components,
};
