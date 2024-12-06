import { css } from '@emotion/css';
import { parser } from '@prometheus-io/lezer-promql';

import { getBackendSrv } from '@grafana/runtime';
import {
  SceneObjectBase,
  SceneComponentProps,
  SceneObjectState,
  SceneCSSGridLayout,
  SceneCSSGridItem,
} from '@grafana/scenes';
import type { Dashboard, DataSourceRef } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { getPreviewPanelFor } from '../../../MetricSelect/previewPanel';

import { SceneChangepointDetector } from './SceneChangepointDetector';
import { SortByScene, SortCriteriaChanged } from './SortByChangepointsScene';

const changepointDetector = new SceneChangepointDetector({
  enabled: true,
});

const groupByOptions = {
  none: 'None',
  dashboard: 'Dashboard',
};

/**
 * Extracts all metric names from a PromQL expression
 * @param {string} promqlExpression - The PromQL expression to parse
 * @returns {string[]} An array of unique metric names found in the expression
 */
function extractMetricNames(promqlExpression: string): string[] {
  const tree = parser.parse(promqlExpression);
  const metricNames = new Set<string>();
  const cursor = tree.cursor();

  do {
    // when we find a VectorSelector...
    if (cursor.type.is('VectorSelector')) {
      // go to its first child
      if (cursor.firstChild()) {
        do {
          // look for the Identifier node
          if (cursor.type.is('Identifier')) {
            const metricName = promqlExpression.slice(cursor.from, cursor.to);
            metricNames.add(metricName);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.next());

  return Array.from(metricNames);
}

interface AnomaliesSceneState extends SceneObjectState {
  dashboardPanelMetrics: DashboardPanelMetrics;
  body: SceneCSSGridLayout;
  loading: 'idle' | 'pending' | 'fulfilled' | 'rejected';
  groupBy: keyof typeof groupByOptions;
  sortBy: SortByScene;
}

interface MetricWithMeta {
  metric: string;
  datasource: { uid: string };
  dashboard: { uid: string; title: string };
}

interface DashboardPanelMetrics {
  byDashboard: { [key: string]: MetricWithMeta[] };
  byDatasource: { [key: string]: MetricWithMeta[] };
}

export class AnomaliesScene extends SceneObjectBase<AnomaliesSceneState> {
  // Cache panel instances by metric+datasource key to avoid recreation during sorting
  private panelInstances: Map<string, SceneCSSGridItem> = new Map();

  constructor(state: Partial<AnomaliesSceneState>) {
    super({
      dashboardPanelMetrics: {
        byDashboard: {},
        byDatasource: {},
      },
      body: new SceneCSSGridLayout({
        children: [],
        autoRows: '175px',
        templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
        isLazy: true,
      }),
      loading: 'idle',
      groupBy: 'none',
      sortBy: new SortByScene({
        target: 'anomalies',
      }),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  _onActivate() {
    this.setState({ loading: 'pending' });
    this._subs.add(
      this.subscribeToEvent(SortCriteriaChanged, (event) => {
        this.sortPanels(event.sortBy);
      })
    );
    changepointDetector.setState({
      metricStates: {},
    });
    // Get all metrics used in dashboards that query Prometheus data sources
    getBackendSrv()
      .get<DashboardSearchItem[]>('/api/search', {
        type: 'dash-db',
        limit: 1000,
      })
      .then((dashboards) => {
        Promise.all(
          dashboards.map(({ uid }) => getBackendSrv().get<{ dashboard: Dashboard }>(`/api/dashboards/uid/${uid}`))
        )
          .then((dashboards) => {
            const newMetrics: {
              byDashboard: { [key: string]: MetricWithMeta[] };
              byDatasource: { [key: string]: MetricWithMeta[] };
            } = {
              byDashboard: {},
              byDatasource: {},
            };

            // this helps us avoid duplicate metric names per datasource
            // when a metric is used in multiple panels
            const metricNamesByDatasource: { [key: string]: Set<string> } = {};

            for (const { dashboard } of dashboards) {
              if (!dashboard.panels?.length || !dashboard.uid) {
                continue;
              }
              const metricsInDashboard: MetricWithMeta[] = [];

              for (const panel of dashboard.panels) {
                const { datasource } = panel;
                if (!isPrometheusDataSource(datasource) || !('targets' in panel) || !panel.targets?.length) {
                  continue;
                }

                const metricsInPanel: string[] = [];
                for (const target of panel.targets) {
                  const expr = typeof target.expr === 'string' ? target.expr : '';
                  const metrics = extractMetricNames(expr);
                  metrics.forEach((metric) => metricsInPanel.push(metric));
                }

                metricsInPanel.forEach((metric) => {
                  if (!metric) {
                    return;
                  }

                  const metricWithMeta: MetricWithMeta = {
                    metric,
                    datasource: { uid: datasource.uid },
                    dashboard: { uid: dashboard.uid!, title: dashboard.title! },
                  };
                  metricsInDashboard.push(metricWithMeta);

                  if (!metricNamesByDatasource[datasource.uid]) {
                    metricNamesByDatasource[datasource.uid] = new Set<string>();
                    newMetrics.byDatasource[datasource.uid] = [];
                  }

                  if (!metricNamesByDatasource[datasource.uid].has(metric)) {
                    metricNamesByDatasource[datasource.uid].add(metric);
                    newMetrics.byDatasource[datasource.uid].push(metricWithMeta);
                  }
                });
              }

              newMetrics.byDashboard[dashboard.uid] = metricsInDashboard;
            }

            this.setState({
              loading: 'fulfilled',
              dashboardPanelMetrics: {
                byDashboard: newMetrics.byDashboard,
                byDatasource: newMetrics.byDatasource,
              },
            });
          })
          .then(() => {
            // TODO: implement more "Group by" logic
            switch (this.state.groupBy) {
              case 'none':
                this.displayAllDashboardMetrics();
                break;
              case 'dashboard':
                this.displayDashboardMetricsByDashboard();
                break;
            }
          });
      })
      .catch(() => {
        this.setState({ loading: 'rejected' });
      });
  }

  /**
   * Generate a unique key for a panel based on its metric name and datasource.
   * Used for both caching panels and ensuring React can track panel identity.
   */
  private getPanelKey(metric: string, datasourceUid: string): string {
    return `${metric}-${datasourceUid}`;
  }

  /**
   * Get an existing panel from the cache or create a new one.
   * This ensures we maintain panel identity across sorts and updates.
   */
  private getOrCreatePanelForMetric(metric: string, datasourceUid: string, index: number): SceneCSSGridItem {
    const key = this.getPanelKey(metric, datasourceUid);

    // If we already have a panel for this metric+datasource, use it
    let panel = this.panelInstances.get(key);
    if (!panel) {
      const detector = changepointDetector.clone();
      detector.setState({
        onChangepointDetected: () => {
          this.handleChangepointDetected(metric);
        },
        onComplexMetric: () => {
          this.handleComplexMetric(metric);
        },
      });

      panel = getPreviewPanelFor(metric, index, 0, undefined, [detector], { uid: datasourceUid });
      this.panelInstances.set(key, panel);
    }

    return panel;
  }

  /**
   * Sort and rerender panels based on the current sort criteria.
   * Uses cached panel instances to prevent unnecessary recreation.
   */
  private sortPanels(sortBy: string) {
    const allMetrics = Object.values(this.state.dashboardPanelMetrics.byDashboard).flat();
    const uniqueMetrics = Array.from(new Map(allMetrics.map((m) => [`${m.metric}-${m.datasource.uid}`, m])).values());

    const sortedMetrics = this.sortMetrics(uniqueMetrics, sortBy);

    const children = sortedMetrics.map(({ metric, datasource: { uid } }, idx) =>
      this.getOrCreatePanelForMetric(metric, uid, idx)
    );

    this.state.body.setState({ children });
  }

  /**
   * Handle when a metric is identified as too complex for changepoint detection
   * (e.g., histograms or multi-field metrics)
   */
  private handleComplexMetric = (metric: string) => {
    const currentStates = changepointDetector.state.metricStates ?? {};
    changepointDetector.setState({
      metricStates: {
        ...currentStates,
        [metric]: {
          changepointCount: 0,
          isComplexMetric: true,
        },
      },
    });
    this.sortPanels(this.state.sortBy.state.sortBy);
  };

  /**
   * Handle when a changepoint is detected in a metric's data.
   * Updates the metric's changepoint count and triggers a resort.
   */
  private handleChangepointDetected = (metric: string) => {
    const currentStates = changepointDetector.state.metricStates ?? {};
    const currentMetricState = currentStates[metric] ?? {
      changepointCount: 0,
      isComplexMetric: false,
    };

    changepointDetector.setState({
      metricStates: {
        ...currentStates,
        [metric]: {
          ...currentMetricState,
          changepointCount: currentMetricState.changepointCount + 1,
        },
      },
    });
    this.sortPanels(this.state.sortBy.state.sortBy);
  };

  /**
   * Sort metrics based on the specified criteria:
   * - 'alphabetical': A-Z by metric name
   * - 'alphabetical-reversed': Z-A by metric name
   * - default: by number of changepoints (highest first), with complex metrics at the end
   */
  private sortMetrics(metrics: MetricWithMeta[], sortBy?: string): MetricWithMeta[] {
    if (sortBy === 'alphabetical') {
      return [...metrics].sort((a, b) => a.metric.localeCompare(b.metric));
    }

    if (sortBy === 'alphabetical-reversed') {
      return [...metrics].sort((a, b) => b.metric.localeCompare(a.metric));
    }

    // Default to changepoints sorting
    return [...metrics].sort((a, b) => {
      // Put complex metrics at the end
      const aState = changepointDetector.state.metricStates?.[a.metric];
      const bState = changepointDetector.state.metricStates?.[b.metric];

      if (aState?.isComplexMetric && !bState?.isComplexMetric) {
        return 1;
      }
      if (!aState?.isComplexMetric && bState?.isComplexMetric) {
        return -1;
      }

      return (bState?.changepointCount || 0) - (aState?.changepointCount || 0);
    });
  }

  /**
   * Display all metrics, showing only one instance of each metric even if it appears
   * in multiple dashboards.
   */
  private displayAllDashboardMetrics() {
    if (!Object.keys(this.state.dashboardPanelMetrics.byDashboard).length) {
      return;
    }

    const allMetrics = Object.values(this.state.dashboardPanelMetrics.byDashboard).flat();

    // deduplicate metrics that appear in multiple dashboards
    const uniqueMetrics = Array.from(new Map(allMetrics.map((m) => [`${m.metric}-${m.datasource.uid}`, m])).values());

    const sortedMetrics = this.sortMetrics(uniqueMetrics);

    const children = sortedMetrics.map(({ metric, datasource: { uid } }, idx) =>
      this.getOrCreatePanelForMetric(metric, uid, idx)
    );

    this.state.body.setState({ children });
  }

  private displayDashboardMetricsByDashboard() {
    for (const [, metrics] of Object.entries(this.state.dashboardPanelMetrics.byDashboard)) {
      const sortedMetrics = this.sortMetrics(metrics);

      const children = sortedMetrics.map(({ metric, datasource: { uid } }, idx) =>
        this.getOrCreatePanelForMetric(metric, uid, idx)
      );

      this.state.body.setState({ children });
    }
  }

  public static Component = ({ model }: SceneComponentProps<AnomaliesScene>) => {
    const { dashboardPanelMetrics, body, loading } = model.useState();
    const styles = useStyles2(getStyles);

    if (loading === 'pending') {
      return (
        <div>
          <Trans i18nKey="trail.metric-select.wingman.anomalies.loading.pending">Loading...</Trans>
        </div>
      );
    }

    if (loading === 'rejected') {
      return (
        <div>
          <Trans i18nKey="trail.metric-select.wingman.anomalies.loading.rejected">Failed to load metrics</Trans>
        </div>
      );
    }

    if (!Object.keys(dashboardPanelMetrics.byDashboard).length) {
      return (
        <div>
          <Trans i18nKey="trail.metric-select.wingman.anomalies.none-found">No metrics found</Trans>
        </div>
      );
    }

    return (
      <div className={styles.outliers}>
        <body.Component model={body} />
      </div>
    );
  };
}

interface DashboardSearchItem {
  id: number;
  uid: string;
  title: string;
  url: string;
  folderTitle?: string;
  folderUid?: string;
  tags: string[];
  isStarred: boolean;
}

function getStyles() {
  return {
    // eslint-disable-next-line @emotion/syntax-preference
    outliers: css`
      /* fix: ensure vertical placement of checkbox when controls are visible */
      button[aria-label='Enable changepoint detection'] > div > label {
        place-content: center;
      }
      /* hide the controls of the changepoint detector */
      .button-group {
        display: none;
      }
    `,
  };
}

function isPrometheusDataSource(input: unknown): input is Required<Pick<DataSourceRef, 'type' | 'uid'>> {
  return (
    typeof input === 'object' &&
    input !== null &&
    'type' in input &&
    input.type === 'prometheus' &&
    'uid' in input &&
    typeof input.uid === 'string'
  );
}
