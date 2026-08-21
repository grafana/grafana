import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { vizPanelToSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

import { type PanelElement } from '../types';

/**
 * Turns a dashboard panel into the panel element a notebook stores.
 *
 * The queries and the panel's own text are interpolated first, because the notebook is a different
 * document: it has
 * no variables of its own (NotebookScene installs only ScopesVariable, and the spec has nowhere to
 * carry definitions), so a query still saying `$service` would resolve to nothing there and quietly
 * return the wrong data. The panel menu's Explore action solves the same problem the same way, via
 * each datasource's own interpolateVariablesInQueries — see getExploreUrl.
 *
 * Values are frozen at the moment of capture, which is what an investigation notebook wants: it
 * records the thing that was being looked at, not a view that drifts with someone else's variable
 * picks. The same freezing applies to `$__interval` and `$__from`/`$__to` if a query names them —
 * the same trade Explore already makes.
 */
export async function buildPanelElementFromDashboard(vizPanel: VizPanel): Promise<PanelElement> {
  const queryRunner = getQueryRunnerFor(vizPanel);

  // Interpolating means editing the panel, so work on a copy — the dashboard the user is still
  // looking at must not have its queries rewritten underneath it. Never activated, so the cloned
  // runner issues no requests.
  const captured = vizPanel.clone();
  const capturedRunner = getQueryRunnerFor(captured);

  if (queryRunner && capturedRunner) {
    capturedRunner.setState({
      queries: await interpolateQueries(queryRunner.state.queries, vizPanel, capturedRunner.state.datasource),
    });
  }

  // Interpolated against the source panel, not the clone: the clone is detached from the dashboard,
  // so it has no variables to resolve through.
  if (captured.state.title) {
    captured.setState({ title: sceneGraph.interpolate(vizPanel, captured.state.title) });
  }

  // The description reads as prose rather than driving a query, so a stray `$service` here is a
  // cosmetic wrong rather than wrong data - but it would still show the reader a variable name that
  // means nothing in a notebook.
  if (captured.state.description) {
    captured.setState({ description: sceneGraph.interpolate(vizPanel, captured.state.description) });
  }

  // Both optional args stay omitted. A dsReferencesMapping would write back the dashboard's
  // unresolved default datasource, and the notebook should carry the datasource the panel actually
  // queried rather than inherit whatever default the dashboard had.
  return vizPanelToSchemaV2(captured);
}

/**
 * Interpolation is the datasource's own business — only it knows which parts of its query language
 * are variable references. A datasource that does not implement it, or that cannot be resolved at all,
 * leaves its queries alone - the same outcome as today rather than a worse one. A datasource whose
 * interpolation throws is a different matter and is allowed to fail the whole add; see below.
 *
 * `__sceneObject` is what lets templateSrv resolve through the scene graph to this panel's variables,
 * exactly as tryGetExploreUrlForPanel passes it.
 */
async function interpolateQueries(
  queries: DataQuery[],
  vizPanel: VizPanel,
  fallbackDatasource: DataQuery['datasource']
): Promise<DataQuery[]> {
  const scopedVars = { __sceneObject: { value: vizPanel } };
  const filters = getQueryRunnerFor(vizPanel)?.state.data?.request?.filters;

  const interpolated = await Promise.all(
    queries.map(async (query) => {
      let datasource;
      try {
        datasource = await getDataSourceInstance(query.datasource || fallbackDatasource);
      } catch {
        // An unresolvable datasource is not a reason to lose the panel: the query goes across as it
        // stands, which is what would have happened without interpolation at all.
        return query;
      }

      // Deliberately outside the catch above. A datasource that cannot be resolved is a known state
      // with a sane answer, but one whose interpolation *throws* is not: swallowing that would write
      // the un-interpolated query and report success, which is precisely the silently-wrong data this
      // function exists to prevent. Better to fail the add than to file the wrong query.
      return datasource.interpolateVariablesInQueries?.([query], scopedVars, filters)?.[0] ?? query;
    })
  );

  return interpolated;
}
