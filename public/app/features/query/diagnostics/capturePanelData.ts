import { dataFrameToJSON, LoadingState, type DataFrameJSON, type PanelData } from '@grafana/data';
import { type SceneQueryRunner, type VizPanel } from '@grafana/scenes';

/** Schema version stamped into paneldata.json so a reader knows how to interpret it. */
const PANEL_DATA_ARTIFACT_VERSION = 1;

/** Identifies which panel a capture came from, whether it succeeded or failed. */
interface PanelDataArtifactHeader {
  version: number;
  panelKey?: string;
  pluginId?: string;
}

/**
 * `paneldata.json`: the data frames the **frontend** was holding for a panel.
 *
 * The counterpart to `querydata.json`, which holds the frames the datasource's **backend** returned.
 * Comparing the two is the point: a datasource plugin's *frontend* code also processes the response
 * (Prometheus, for one, does a lot of it), so frames present in `querydata.json` but missing or altered
 * here localise the loss to the plugin's frontend rather than its backend or the upstream.
 */
export interface PanelDataArtifact extends PanelDataArtifactHeader {
  /** LoadingState at capture time (`Done`, `Error`, `Loading`, …), as the query runner reported it. */
  state?: string;
  request?: PanelDataRequestContext;
  /** Why the frames are missing or short, when the frontend knows. Omitted when the query did not error. */
  errors?: PanelDataError[];
  frames: DataFrameJSON[];
}

/**
 * A query error as the frontend recorded it — the counterpart to the missing frames.
 *
 * Without this the artifact can prove a frontend loss and not explain it: when a plugin's frontend
 * throws, `runRequest`'s `catchError` emits `state: Error` with no series, so the capture shows empty
 * `frames` against a healthy `querydata.json` and the reason is nowhere in the bundle — `traffic.har`
 * recorded a successful round trip and the server logs never saw a browser-side exception.
 *
 * Scalar fields only, copied out one by one rather than spread. `toDataQueryError` returns *the object
 * that was thrown* with a `message` attached, so `PanelData.error` is not the tidy `DataQueryError` its
 * type suggests — it can be a fetch/axios error carrying a circular `config` or `request`. Spreading it
 * would push captures that are otherwise fine into `captureError`, losing the frames to salvage the
 * explanation for why they are missing.
 */
interface PanelDataError {
  refId?: string;
  message?: string;
  status?: number;
  statusText?: string;
  traceId?: string;
  type?: string;
  /** `data.error`: the server's detailed message, populated only when Grafana runs in development mode. */
  detail?: string;
}

/**
 * A capture that threw, recorded in place of the frames.
 *
 * Deliberately carries no `frames` key: an empty one would read as "the frontend was holding nothing",
 * which is the frontend-loss misreading this artifact exists to settle. With this shape an absent
 * `paneldata.json` means there was nothing to capture — no query runner, or no resolved data — rather
 * than a capture that broke on the way out.
 */
export interface PanelDataCaptureFailure extends PanelDataArtifactHeader {
  captureError: string;
}

/** What the drawer sends as `panelData`, either way. */
export type PanelDataPayload = PanelDataArtifact | PanelDataCaptureFailure;

/**
 * The request these frames were produced from, so the `querydata.json` diff can be read correctly —
 * unless `inFlight` is set, in which case they were not.
 */
interface PanelDataRequestContext {
  /** Epoch ms, matching the units of the `from`/`to` the diagnostics request sends. */
  from: number;
  to: number;
  intervalMs?: number;
  maxDataPoints?: number;
  /**
   * Set when this request had returned nothing yet at capture time, so the frames are *not* its output:
   * `runRequest` emits a loading packet carrying the new request and no series 200ms into every query,
   * and `preProcessPanelData` then refills those empty series from the panel's previous result. So a
   * capture taken mid-refresh holds the previous run's frames (or none, on a first load) while the
   * request describes the run still in flight — this window and resolution must not be used to explain
   * a difference against `querydata.json`.
   */
  inFlight?: true;
}

function captureErrors(data: PanelData): PanelDataError[] | undefined {
  // errors[] is the modern field, but runRequest's catchError sets only the deprecated singular error --
  // which is exactly the plugin-frontend-threw case this is here for. Read both.
  const errors = data.errors?.length ? data.errors : data.error ? [data.error] : [];
  if (!errors.length) {
    return undefined;
  }

  return errors.map((error) => ({
    refId: error.refId,
    message: error.message,
    status: error.status,
    statusText: error.statusText,
    traceId: error.traceId,
    type: error.type,
    detail: error.data?.error,
  }));
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
 * Two caveats for the diff, both cases of core moving data around rather than the plugin losing it:
 *
 * 1. Core normalises every frame on the way in — `preProcessPanelData` runs each through `toDataFrame`
 *    and `guessFieldTypes` — so a field the backend typed one way and this artifact types another is
 *    core normalising, not the plugin rewriting anything.
 * 2. Annotation frames are **not** here. `processResponsePacket` routes every frame whose
 *    `meta.dataTopic` is `Annotations` out of `series` and into `PanelData.annotations`, so a datasource
 *    that returns them from a panel query (testdata's annotations scenario, the dashboard datasource)
 *    has those frames in `querydata.json` and absent here — which reads as exactly the frontend loss
 *    this artifact exists to prove. They are left out rather than captured because
 *    `SceneQueryRunner._combineDataLayers` merges the dashboard's own annotation layers into that field,
 *    so it is not the datasource's output alone and the part that is is not separately reachable.
 *
 * Takes the query runner the caller already resolved rather than walking to it again, so the frames here
 * are guaranteed to come from the same runner as the queries the caller sends alongside them.
 *
 * Returns `undefined` when there is no query runner or no resolved data, so the caller simply omits the
 * artifact rather than sending an empty one.
 */
export function capturePanelData(panel: VizPanel, runner: SceneQueryRunner | undefined): PanelDataArtifact | undefined {
  const data = runner?.state.data;
  if (!data) {
    return undefined;
  }

  const request = data.request;
  // endTime is stamped onto the request when its first response packet arrives, so an unset endTime on a
  // Loading packet marks exactly the case where the frames and the request come from different runs (see
  // inFlight). Once a packet has landed, a Loading or Streaming state is this request's own partial output.
  const inFlight = data.state === LoadingState.Loading && request?.endTime === undefined;

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
          inFlight: inFlight ? true : undefined,
        }
      : undefined,
    // Omitted when the query did not error, so an absent key reads as "nothing went wrong here" rather
    // than "nobody looked".
    errors: captureErrors(data),
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
 * Records a capture that failed, so the omission is visible in the bundle.
 *
 * Sending nothing would leave a support engineer unable to tell a browser that had no frames to give from
 * a capture that broke on the way out — the same conflation the backend's `WithPanelData` refuses to make
 * between an absent payload and an empty one.
 */
export function capturePanelDataFailure(panel: VizPanel, error: unknown): PanelDataCaptureFailure {
  return {
    version: PANEL_DATA_ARTIFACT_VERSION,
    panelKey: panel.state.key,
    pluginId: panel.state.pluginId,
    captureError: error instanceof Error ? error.message : String(error),
  };
}
