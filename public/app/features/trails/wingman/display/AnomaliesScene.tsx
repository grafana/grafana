import { css } from '@emotion/css';
import { parser } from '@prometheus-io/lezer-promql';

import { getBackendSrv } from '@grafana/runtime';
import {
  SceneObjectBase,
  SceneComponentProps,
  SceneObjectState,
  sceneGraph,
  SceneCSSGridLayout,
} from '@grafana/scenes';
import { SceneChangepointDetector } from '@grafana/scenes-ml';
import type { Dashboard, DataSourceRef } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';

import { getPreviewPanelFor } from '../../MetricSelect/previewPanel';

const changepointDetector = new SceneChangepointDetector({
  enabled: false,
  onChangepointDetected: (changepoint) => {
    console.log('Changepoint detected:', JSON.stringify(changepoint, null, 2));
  },
});

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
}

interface MetricWithMeta {
  metric: string;
  datasource: { uid: string };
  dashboard: { uid: string; title: string };
}

interface DashboardPanelMetrics {
  byDashboard: { [key: string]: MetricWithMeta[] };
}

const ANOMALIES_GRID_KEY = 'anomalies_grid';

export class AnomaliesScene extends SceneObjectBase<AnomaliesSceneState> {
  constructor(state: Partial<AnomaliesSceneState>) {
    super({
      dashboardPanelMetrics: {
        byDashboard: {},
      },
      body: new SceneCSSGridLayout({
        key: ANOMALIES_GRID_KEY,
        children: [],
        autoRows: '175px',
        templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
        isLazy: true,
      }),
      loading: 'idle',
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  _onActivate() {
    this.setState({ loading: 'pending' });
    // Get all metrics used in dashboards that query Prometheus data sources
    getBackendSrv()
      .get<DashboardSearchItem[]>('/api/search', {
        type: 'dash-db',
        limit: 1000,
      })
      .then((dashboards) => {
        Promise.all(
          dashboards.map(({ uid }) => getBackendSrv().get<{ dashboard: Dashboard }>(`/api/dashboards/uid/${uid}`))
        ).then((dashboards) => {
          const newMetrics: {
            byDashboard: { [key: string]: MetricWithMeta[] };
            metricNames: Set<string>;
          } = {
            byDashboard: {},
            metricNames: new Set(),
          };

          for (const { dashboard } of dashboards) {
            if (!dashboard.panels?.length || !dashboard.uid) {
              continue;
            }
            const metricsInDashboard: MetricWithMeta[] = [];

            for (const panel of dashboard.panels) {
              if (
                !isPrometheusDataSource(panel.datasource) ||
                !('targets' in panel) ||
                !panel.targets?.length ||
                typeof panel.datasource?.uid !== 'string'
              ) {
                continue;
              }

              const metricsInPanel: string[] = [];
              for (const target of panel.targets) {
                const expr = (target.expr as string) ?? '';
                const metrics = extractMetricNames(expr);
                metrics.forEach((metric) => metricsInPanel.push(metric));
              }

              metricsInPanel.forEach((metric) => {
                newMetrics.metricNames.add(metric);
                metricsInDashboard.push({
                  metric,
                  datasource: { uid: panel.datasource!.uid! },
                  dashboard: { uid: dashboard.uid!, title: dashboard.title! },
                });
              });
            }

            newMetrics.byDashboard[dashboard.uid!] = metricsInDashboard;
          }

          this.setState({
            dashboardPanelMetrics: {
              byDashboard: newMetrics.byDashboard,
            },
          });

          if (Object.keys(this.state.dashboardPanelMetrics.byDashboard).length) {
            sceneGraph.findByKeyAndType(this, ANOMALIES_GRID_KEY, SceneCSSGridLayout).setState({
              children: Object.values(this.state.dashboardPanelMetrics.byDashboard)
                .flat()
                .map(({ metric, datasource: { uid } }, idx) =>
                  getPreviewPanelFor(metric, idx, 0, undefined, [changepointDetector.clone()], { uid })
                ),
            });
          }

          this.setState({ loading: 'fulfilled' });
        });
      })
      .catch(() => {
        this.setState({ loading: 'rejected' });
      });
  }

  public static Component = ({ model }: SceneComponentProps<AnomaliesScene>) => {
    const { dashboardPanelMetrics, body, loading } = model.useState();
    const styles = useStyles2(getStyles);

    if (loading === 'pending') {
      return <div>Loading...</div>;
    }

    if (!Object.keys(dashboardPanelMetrics.byDashboard).length) {
      return <div>No metrics found</div>;
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
      button[aria-label='Enable changepoint detection'] > div > label {
        place-content: center;
      }
    `,
  };
}

function isPrometheusDataSource(input: unknown): input is Required<Pick<DataSourceRef, 'type' | 'uid'>> {
  return typeof input === 'object' && input !== null && 'type' in input && input.type === 'prometheus';
}
