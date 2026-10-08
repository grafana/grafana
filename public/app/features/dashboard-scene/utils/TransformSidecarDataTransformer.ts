import {
  type DataQueryRequest,
  type DataSourceApi,
  type DataTransformerConfig,
  type PanelData,
  standardTransformers,
} from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';
import { ExpressionDatasourceRef, FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  sceneGraph,
  SceneDataTransformer,
  type SceneDataTransformerState,
  SceneQueryRunner,
  type SceneTimeRangeLike,
} from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

/** RefId of the transform expression added to a panel's request. */
export const TRANSFORM_SIDECAR_REF_ID = '__transformSidecar';

// The transformations the sidecar registers (scripts/transform-sidecar/src/transform.ts).
const SIDECAR_TRANSFORMATIONS = new Set(Object.values(standardTransformers).map((t) => t.id));

const patchedRunners = new WeakSet<SceneQueryRunner>();

// The shape of SceneQueryRunner.prepareRequests, which @grafana/scenes declares without types.
interface PreparedRequests {
  primary: DataQueryRequest;
  secondaries: DataQueryRequest[];
  processors: Map<string, unknown>;
}

/**
 * Experimental, behind grafana.dashboardTransformationsSidecar: runs a panel's transformations in
 * the transform sidecar (scripts/transform-sidecar) instead of in the browser.
 *
 * The panel's request gets one extra "transform" expression that takes every visible query as
 * input, and the visible queries are hidden so only the transformed frames come back. The browser
 * then skips the transformations it would otherwise apply. Scene state is untouched, so the
 * dashboard saves exactly as before, and turning the flag off takes effect on the next query.
 *
 * Panels keep browser transformations when the sidecar can't produce the same result: unsupported
 * or annotation transformations, panels that already use expressions, mixed or frontend-only data
 * sources, extra queries (for example time comparison), or system transformations that must run
 * before the user's.
 */
export class TransformSidecarDataTransformer extends SceneDataTransformer {
  private appliedOnServer = false;

  constructor(state: SceneDataTransformerState) {
    super(state);

    // transform, _withSystemTransformations and SceneQueryRunner.prepareRequests are private in
    // @grafana/scenes. Element access reaches them without changing scenes, which is acceptable for
    // a PoC; a real implementation would add a hook to scenes instead.
    const transform = this['transform'].bind(this);
    this['transform'] = (data: PanelData | undefined, force?: boolean) => {
      this.appliedOnServer = isSidecarResponse(data);
      return transform(data, force);
    };
    const withSystemTransformations = this['_withSystemTransformations'].bind(this);
    this['_withSystemTransformations'] = (...[system, transformations]: Parameters<typeof withSystemTransformations>) =>
      withSystemTransformations(system, this.appliedOnServer ? [] : transformations);

    patchQueryRunner(state.$data);
    this.addActivationHandler(() => {
      patchQueryRunner(this.state.$data);
      const sub = this.subscribeToState((next, prev) => {
        if (next.$data !== prev.$data) {
          patchQueryRunner(next.$data);
        }
      });
      return () => sub.unsubscribe();
    });
  }
}

function patchQueryRunner(provider: unknown) {
  if (!(provider instanceof SceneQueryRunner) || patchedRunners.has(provider)) {
    return;
  }
  patchedRunners.add(provider);

  const prepareRequests: (timeRange: SceneTimeRangeLike, ds: DataSourceApi) => PreparedRequests =
    provider['prepareRequests'].bind(provider);
  provider['prepareRequests'] = (timeRange: SceneTimeRangeLike, ds: DataSourceApi): PreparedRequests => {
    const prepared = prepareRequests(timeRange, ds);
    // Extra queries are merged with the primary result in the browser, after transformations
    // would have run, so the sidecar can't replace them.
    if (prepared.secondaries.length > 0) {
      return prepared;
    }
    const primary = withSidecarTransform(provider, prepared.primary, ds);
    return primary ? { ...prepared, primary } : prepared;
  };
}

function withSidecarTransform(
  runner: SceneQueryRunner,
  request: DataQueryRequest,
  ds: DataSourceApi
): DataQueryRequest | undefined {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardTransformationsSidecar, false)) {
    return undefined;
  }

  const transformer = runner.parent;
  if (!(transformer instanceof TransformSidecarDataTransformer)) {
    return undefined;
  }

  const transformations = transformer.state.transformations;
  if (!transformations.every(isDataTransformerConfig)) {
    return undefined;
  }
  const active = transformations.filter((t) => !t.disabled);
  if (active.length === 0 || !active.every((t) => SIDECAR_TRANSFORMATIONS.has(t.id) && isSeriesTopic(t))) {
    return undefined;
  }
  if (transformer.getResolvedSystemTransformations().prepend.length > 0) {
    return undefined;
  }

  // Mixed requests are split by data source, which would separate the expression from its inputs.
  if (!ds.meta?.backend || ds.meta.mixed) {
    return undefined;
  }
  if (request.targets.some((t) => isExpressionReference(t.datasource))) {
    return undefined;
  }
  const visible = request.targets.filter((t) => !t.hide);
  if (visible.length === 0) {
    return undefined;
  }

  const transformQuery = {
    refId: TRANSFORM_SIDECAR_REF_ID,
    datasource: ExpressionDatasourceRef,
    type: 'transform',
    inputs: visible.map((t) => t.refId),
    transformations: JSON.parse(
      sceneGraph.interpolate(transformer, JSON.stringify(transformations), request.scopedVars)
    ),
    timezone: resolveTimeZone(request.timezone),
  };

  return {
    ...request,
    targets: [...request.targets.map((t) => (t.hide ? t : { ...t, hide: true })), transformQuery],
  };
}

function isDataTransformerConfig(t: unknown): t is DataTransformerConfig {
  return typeof t === 'object' && t !== null && 'id' in t && typeof t.id === 'string';
}

function isSeriesTopic(t: DataTransformerConfig): boolean {
  return t.topic === undefined || t.topic === 'series';
}

function isSidecarResponse(data: PanelData | undefined): boolean {
  return Boolean(data?.request?.targets.some((t: DataQuery) => t.refId === TRANSFORM_SIDECAR_REF_ID));
}

// The sidecar defaults to UTC; a dashboard on "browser" time should format times the way the
// browser would.
function resolveTimeZone(timeZone: string | undefined): string {
  if (!timeZone || timeZone === 'browser') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return timeZone;
}
