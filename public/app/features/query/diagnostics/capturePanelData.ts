import { dataFrameToJSON, type DataFrameJSON } from '@grafana/data';
import { SceneDataTransformer, SceneQueryRunner, type SceneObject, type VizPanel } from '@grafana/scenes';

/** Schema version stamped into paneldata.json so a reader knows how to interpret it. */
const PANEL_DATA_ARTIFACT_VERSION = 1;

/**
 * `paneldata.json`: the data frames the **frontend** was holding for a panel.
 *
 * The counterpart to `querydata.json`, which holds the frames the datasource's **backend** returned.
 * Comparing the two is the point: a datasource plugin's *frontend* code also processes the response
 * (Prometheus, for one, does a lot of it), so frames present in `querydata.json` but missing or altered
 * here localise the loss to the plugin's frontend rather than its backend or the upstream.
 */
interface PanelDataArtifact {
  version: number;
  panelKey?: string;
  pluginId?: string;
  /** LoadingState at capture time (`Done`, `Error`, `Loading`, …), as the query runner reported it. */
  state?: string;
  request?: PanelDataRequestContext;
  frames: DataFrameJSON[];
}

/**
 * The request these frames were produced from, so the `querydata.json` diff can be read correctly.
 */
interface PanelDataRequestContext {
  /** Epoch ms, matching the units of the `from`/`to` the diagnostics request sends. */
  from: number;
  to: number;
  intervalMs?: number;
  maxDataPoints?: number;
}

/**
 * Serialises the frames a panel's query runner is holding, for bundling as `paneldata.json`.
 *
 * Reads already-resolved scene state, so it runs no queries and re-applies no transformations: it records
 * what the frontend had at the moment the user asked for a bundle. Frames use `DataFrameJSON`, the same
 * encoding the backend uses for `querydata.json`, so the two can be diffed field-for-field.
 *
 * **Scope, deliberately narrow.** This captures the *query runner's* output — the datasource's frames
 * after the plugin's own frontend processing — and nothing further down the pipeline. Transformations,
 * field config, axis ticks and legend calcs are all applied later, so neither a transform that drops data
 * nor a *rendering* fault is visible here. This artifact answers exactly one question: did the plugin's
 * frontend return what its backend produced?
 *
 * Returns `undefined` when the panel has no query runner or no resolved data, so the caller simply omits
 * the artifact rather than sending an empty one.
 */
export function capturePanelData(panel: VizPanel): PanelDataArtifact | undefined {
  const runner = findQueryRunner(panel);
  const data = runner?.state.data;
  if (!data) {
    return undefined;
  }

  const request = data.request;

  return {
    version: PANEL_DATA_ARTIFACT_VERSION,
    panelKey: panel.state.key,
    pluginId: panel.state.pluginId,
    state: data.state,
    // Omitted rather than sent half-empty when the panel has data but no recorded request (e.g. frames
    // supplied by a snapshot rather than a query).
    request: request
      ? {
          from: request.range.from.valueOf(),
          to: request.range.to.valueOf(),
          intervalMs: request.intervalMs,
          maxDataPoints: request.maxDataPoints,
        }
      : undefined,
    // Deliberately unbounded, for now. A very large panel makes for a large request body, and past
    // web.MaxBindBodyBytes (100MiB) web.Bind rejects it and the whole bundle is lost rather than just
    // this artifact. That is accepted at this stage: the feature is experimental, admin-only and
    // on-prem gated, and no bound can be chosen well before we have seen what real bundles weigh. When
    // it is added it belongs here rather than on the backend (which deliberately defers the decision to
    // this side, see the "oversized payload" row in the backend PR), and it should drop frames first,
    // keep the identifying fields, and stamp a truncation marker so a reduced capture is never misread
    // as data the frontend lost.
    frames: (data.series ?? []).map((frame) => dataFrameToJSON(frame)),
  };
}

/**
 * Walks the panel's data chain to its query runner.
 *
 * A panel's `$data` is either a `SceneQueryRunner` or a `SceneDataTransformer` wrapping one, and the
 * provider can also live on the parent (repeat clones share it), which is why both are checked —
 * mirroring getQueryRunnerFor in the diagnostics drawers.
 */
function findQueryRunner(sceneObject: SceneObject | undefined): SceneQueryRunner | undefined {
  if (!sceneObject) {
    return undefined;
  }
  const provider = sceneObject.state.$data ?? sceneObject.parent?.state.$data;
  if (provider instanceof SceneQueryRunner) {
    return provider;
  }
  if (provider instanceof SceneDataTransformer) {
    return findQueryRunner(provider);
  }
  return undefined;
}
