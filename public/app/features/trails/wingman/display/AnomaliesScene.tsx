import { parser } from '@prometheus-io/lezer-promql';

import { getBackendSrv } from '@grafana/runtime';
import {
  SceneObjectBase,
  SceneComponentProps,
  SceneObjectState,
  sceneGraph,
  SceneCSSGridLayout,
} from '@grafana/scenes';
import type { Dashboard, Panel } from '@grafana/schema';

import { getPreviewPanelFor } from '../../MetricSelect/previewPanel';
import { VAR_DATASOURCE_EXPR } from '../../shared';

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
  anomalies: string[];
  body: SceneCSSGridLayout;
}

const ANOMALIES_GRID_KEY = 'anomalies_grid';

export class AnomaliesScene extends SceneObjectBase<AnomaliesSceneState> {
  private metrics: string[] = [];

  constructor(state: Partial<AnomaliesSceneState>) {
    super({
      anomalies: [],
      body: new SceneCSSGridLayout({
        key: ANOMALIES_GRID_KEY,
        children: [],
        autoRows: '200px',
        templateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        isLazy: true,
      }),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  _onActivate() {
    getBackendSrv()
      .get<DashboardSearchItem[]>('/api/search', {
        type: 'dash-db',
        limit: 1000,
        sort: 'name-asc',
      })
      .then((dashboards) => {
        const datasourceUid = sceneGraph.interpolate(this, VAR_DATASOURCE_EXPR);
        Promise.all(
          dashboards.map(({ uid }) => getBackendSrv().get<{ dashboard: Dashboard }>(`/api/dashboards/uid/${uid}`))
        ).then((dashboards) => {
          const exprs = dashboards
            .flatMap(({ dashboard }) => {
              if (!dashboard.panels?.length) {
                return;
              }

              const panels = dashboard.panels.filter((panel: Panel) => panel.datasource?.uid === datasourceUid);

              return panels.map((panel: Panel) => {
                const expr = (panel.targets?.[0].expr as string) ?? '';

                return expr;
              });
            })
            .filter((expr) => isString(expr));
          this.metrics = Array.from(new Set(exprs.flatMap((expr) => extractMetricNames(expr))));
          this.setState({ anomalies: this.metrics });

          if (this.state.anomalies.length) {
            sceneGraph.findByKeyAndType(this, ANOMALIES_GRID_KEY, SceneCSSGridLayout).setState({
              children: this.state.anomalies.map((anomaly, idx) => getPreviewPanelFor(anomaly, idx, 0)),
            });
          }
        });
      });
  }

  public static Component = ({ model }: SceneComponentProps<AnomaliesScene>) => {
    const { anomalies, body } = model.useState();

    if (!anomalies.length) {
      return <div>No anomalies found</div>;
    }

    return (
      <div id="ismail simsek">
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

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
