import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { vizPanelToSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { getLibraryPanelBehavior, getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

import { type PanelElement } from '../types';

/**
 * Turns a dashboard panel into the panel element a notebook stores.
 *
 * Queries and panel text are interpolated first: a notebook has no variables of its own, so a query
 * still saying `$service` would resolve to nothing there and quietly return the wrong data. Explore
 * solves the same problem the same way — see getExploreUrl.
 *
 * Two things are not frozen along with the rest. The Grafana time macros stay dynamic (see
 * preserveTimeMacros), and the datasource is resolved rather than kept as written.
 */
export async function buildPanelElementFromDashboard(vizPanel: VizPanel): Promise<PanelElement> {
  const queryRunner = getQueryRunnerFor(vizPanel);

  // Interpolating means editing the panel, so work on a copy — the dashboard the user is still
  // looking at must not have its queries rewritten underneath it.
  const captured = vizPanel.clone();
  const capturedRunner = getQueryRunnerFor(captured);

  // `__sceneObject` lets templateSrv resolve through the scene graph to this panel's variables. The
  // datasource lookups need it too, or `${datasource}` has no scope to resolve against.
  const scopedVars = { __sceneObject: { value: vizPanel } };

  if (queryRunner && capturedRunner) {
    const [queries, datasource] = await Promise.all([
      interpolateQueries(queryRunner.state.queries, vizPanel, capturedRunner.state.datasource, scopedVars),
      resolveDatasource(capturedRunner.state.datasource, scopedVars),
    ]);

    capturedRunner.setState({ queries, ...(datasource && { datasource }) });
  }

  // Interpolated against the source panel, not the clone: the clone is detached from the dashboard,
  // so it has no variables to resolve through. Time macros are stashed for the same reason the
  // queries stash them - a title naming the window has to follow the notebook's, not the dashboard's.
  if (captured.state.title) {
    captured.setState({
      // `text` is the format VizPanelRenderer titles with, so a variable whose label differs from its
      // value reads as the label the panel showed rather than the value behind it.
      title: preserveTimeMacros(captured.state.title, (title) =>
        sceneGraph.interpolate(vizPanel, title, undefined, 'text')
      ),
    });
  }

  // The description reads as prose rather than driving a query, so a stray `$service` here is a
  // cosmetic wrong rather than wrong data - but it would still show the reader a variable name that
  // means nothing in a notebook.
  if (captured.state.description) {
    captured.setState({
      // No format, unlike the title: VizPanel.getDescription interpolates without one before
      // rendering the markdown, and this should land what the panel would have shown.
      description: preserveTimeMacros(captured.state.description, (description) =>
        sceneGraph.interpolate(vizPanel, description)
      ),
    });
  }

  inlineLibraryPanel(vizPanel, captured);

  // Both optional args stay omitted. A dsReferencesMapping would write back the dashboard's
  // unresolved default datasource, and the notebook should carry the datasource the panel actually
  // queried rather than inherit whatever default the dashboard had.
  return vizPanelToSchemaV2(captured);
}

/**
 * Detaches the library panel behavior from the clone, so it serializes as an ordinary panel.
 *
 * vizPanelToSchemaV2 emits a bare `{ uid, name }` reference for anything still carrying it, throwing
 * away every rewrite above. The behavior has already written the library panel's whole model onto
 * this VizPanel, so the clone only has to stop advertising where it came from — at the cost of no
 * longer following later library edits.
 *
 * A behavior still loading has not written that model yet, so that case keeps the reference rather
 * than storing an empty panel.
 */
function inlineLibraryPanel(source: VizPanel, captured: VizPanel): void {
  if (!getLibraryPanelBehavior(source)?.state.isLoaded) {
    return;
  }

  const behavior = getLibraryPanelBehavior(captured);
  captured.setState({ $behaviors: captured.state.$behaviors?.filter((candidate) => candidate !== behavior) });
}

/**
 * Interpolation is the datasource's own business — only it knows which parts of its query language
 * are variable references. A datasource that does not implement it, or that cannot be resolved at all,
 * leaves its queries alone - the same outcome as today rather than a worse one. A datasource whose
 * interpolation throws is a different matter and is allowed to fail the whole add; see below.
 */
async function interpolateQueries(
  queries: DataQuery[],
  vizPanel: VizPanel,
  fallbackDatasource: DataQuery['datasource'],
  scopedVars: Record<string, { value: unknown }>
): Promise<DataQuery[]> {
  const filters = getQueryRunnerFor(vizPanel)?.state.data?.request?.filters;

  const interpolated = await Promise.all(
    queries.map(async (query) => {
      let datasource;
      try {
        datasource = await getDataSourceInstance(query.datasource || fallbackDatasource, scopedVars);
      } catch {
        // An unresolvable datasource is not a reason to lose the panel: the query goes across as it
        // stands, which is what would have happened without interpolation at all.
        return query;
      }

      // Deliberately outside the catch above: swallowing a throw here would file the raw query and
      // report success, which is the silently-wrong data this function exists to prevent.
      const rewritten = preserveTimeMacros(
        query,
        (stashed) => datasource.interpolateVariablesInQueries?.([stashed], scopedVars, filters)?.[0] ?? stashed
      );

      return {
        ...rewritten,
        // Same write-back getExploreUrl performs. Mixed is skipped because it is a panel-level
        // arrangement — stamping it on a query would claim the query itself is mixed.
        ...(!datasource.meta?.mixed && { datasource: datasource.getRef() }),
      };
    })
  );

  return interpolated;
}

/** The panel's own datasource, resolved, so a `${datasource}` panel is not serialized as one. */
async function resolveDatasource(
  ref: DataQuery['datasource'],
  scopedVars: Record<string, { value: unknown }>
): Promise<DataSourceRef | undefined> {
  if (!ref) {
    return undefined;
  }

  try {
    return (await getDataSourceInstance(ref, scopedVars)).getRef();
  } catch {
    // Same bargain as the queries: an unresolvable datasource keeps whatever the panel had.
    return undefined;
  }
}

/**
 * The time macros are scene macros, so interpolation resolves them against the dashboard's range —
 * and a notebook has its own range the reader can change. Stashed behind tokens for the duration of
 * the call and put back after, so the notebook stores the macro and re-runs in its own window.
 *
 * Round-tripped through JSON so a macro is found wherever a datasource keeps it. Shadowing through
 * `scopedVars` would be shorter, but a format suffix still applies to the shadow's value, mangling
 * `$__from:date:iso`; stashing the whole reference does not.
 *
 * Deliberately wider than what scenes resolves today: only `__from`, `__to`, `__interval` and
 * `__interval_ms` have macros, but `registerVariableMacro` is public and Grafana already uses it, so
 * a list matching the registry exactly would silently narrow the moment one is added.
 */
const TIME_MACRO_NAMES = [
  // Longest first, so `$__interval_ms` is not matched as `$__interval` with a suffix.
  '__interval_ms',
  '__interval',
  '__rate_interval',
  '__range_ms',
  '__range_s',
  '__range',
  '__from',
  '__to',
].join('|');

const TIME_MACRO = new RegExp(
  `\\$(?:\\{\\s*(?:${TIME_MACRO_NAMES})\\b[^}]*\\}|(?:${TIME_MACRO_NAMES})\\b(?::[\\w:.-]+)?)`,
  'g'
);
const MACRO_PLACEHOLDER = 'grafana_notebook_time_macro';

function preserveTimeMacros<T>(value: T, interpolate: (value: T) => T): T {
  const macros: string[] = [];
  const stashed = JSON.stringify(value).replace(TIME_MACRO, (match) => {
    macros.push(match);
    return `${MACRO_PLACEHOLDER}_${macros.length - 1}_`;
  });

  if (macros.length === 0) {
    return interpolate(value);
  }

  const interpolated = JSON.stringify(interpolate(JSON.parse(stashed)));

  return JSON.parse(
    interpolated.replace(
      new RegExp(`${MACRO_PLACEHOLDER}_(\\d+)_`, 'g'),
      (match, index) => macros[Number(index)] ?? match
    )
  );
}
