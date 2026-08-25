import { type DataQuery } from '@grafana/data';
import { type SceneQueryRunner } from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

/**
 * Writes a new query array onto the runner, keeping the runner-level `datasource` in sync.
 *
 * Each row in PanelQueryEditor resolves and displays its own query's datasource independently (see
 * PanelQueryEditorRow), but that's only the editing UI. What a query actually runs against is decided
 * by the *runner's* own `state.datasource`: a regular datasource plugin ignores each query's own
 * `datasource` field entirely and just runs every query in the request against itself — only the
 * "-- Mixed --" pseudo-datasource plugin looks at each query's own field and dispatches accordingly.
 * So the moment two queries here point at different datasources, the runner-level datasource has to
 * become Mixed or every query silently runs against whichever one the runner was last pointed at,
 * regardless of what the row for a different query shows. Same detection this codebase's other
 * multi-query editors (QueryEditorRows, PanelDataQueriesTab) already do on every query-array change.
 *
 * Two or more queries all targeting the "-- Dashboard --" pseudo-datasource also force Mixed, even
 * though they'd otherwise look like a single shared uid: that datasource only ever handles one target
 * per request, so a non-Mixed runner sending it two would silently drop all but one. Same special
 * case `getPanelDataSource` (layoutSerializers/utils.ts) already carves out for the same reason.
 */
export function setQueryRunnerQueries(queryRunner: SceneQueryRunner, queries: DataQuery[]): void {
  const uniqueDatasourceUids = new Set(queries.map((query) => query.datasource?.uid));
  const dashboardQueryCount = queries.filter((query) => query.datasource?.uid === SHARED_DASHBOARD_QUERY).length;
  const isMixed = uniqueDatasourceUids.size > 1 || dashboardQueryCount > 1;
  const datasource = isMixed ? { uid: MIXED_DATASOURCE_NAME, type: 'mixed' } : (queries[0]?.datasource ?? undefined);

  queryRunner.setState({ queries, datasource });
}
