import { type DataQuery } from '@grafana/data';
import { type SceneQueryRunner } from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/constants';

/**
 * Writes a new query array onto the runner, keeping the runner-level `datasource` in sync.
 *
 * Each PanelQueryEditorRow resolves and displays its own query's datasource, but only the runner's
 * `state.datasource` decides what a query actually runs against: a regular datasource plugin ignores
 * each query's own `datasource` field and runs every query against itself — only "-- Mixed --" reads
 * per-query datasources. So once two queries here disagree, the runner must switch to Mixed.
 *
 * Two or more queries sharing the "-- Dashboard --" pseudo-datasource also force Mixed, since that
 * datasource only handles one target per request — the same special case `getPanelDataSource`
 * (layoutSerializers/utils.ts) carves out.
 */
export function setQueryRunnerQueries(queryRunner: SceneQueryRunner, queries: DataQuery[]): void {
  const dashboardQueryCount = queries.filter((query) => query.datasource?.uid === SHARED_DASHBOARD_QUERY).length;
  const first = queries[0]?.datasource;
  // Comparing uid alone isn't enough: a type-only reference (e.g. `{ type: 'prometheus' }`, as
  // panelQueryKindToSceneQuery produces) has an undefined uid, so two different type-only queries
  // would otherwise look identical. getPanelDataSource does the same uid+type comparison.
  const hasDifferentDatasources = queries.some(
    (query) => query.datasource?.uid !== first?.uid || query.datasource?.type !== first?.type
  );
  const isMixed = hasDifferentDatasources || dashboardQueryCount > 1;
  const datasource = isMixed ? { uid: MIXED_DATASOURCE_NAME, type: 'mixed' } : (first ?? undefined);

  queryRunner.setState({ queries, datasource });
}
