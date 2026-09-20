import { LoadingState, type DataFrame, type PanelData, type TimeRange } from '@grafana/data';

/** What the element asks a provider for when it mounts or its time range changes. */
export interface EmbedDataRequest {
  timeRange: TimeRange;
  /** Width-derived hint; a provider is free to ignore it. */
  maxDataPoints: number;
}

/**
 * The host owns data. An embedded panel never holds a datasource, a token or a fetch,
 * which is what lets the same element work in a sandboxed agent iframe, in a wiki page
 * and inside a partner's app.
 *
 * Shaped so that adapting to or from Scenes' SceneDataProvider is mechanical, but
 * without putting rxjs in a plain-HTML host's way.
 */
export interface EmbedDataProvider {
  /** Push data to the element. Returns an unsubscribe function. */
  subscribe(onData: (data: EmbedPanelData) => void): () => void;
  /** The element requests a window; results arrive through subscribe. */
  query?(request: EmbedDataRequest): void;
}

/**
 * What a provider emits. timeRange is optional on purpose: a provider handing over
 * frames it already holds has no window of its own, and the element fills in its
 * current one, so static frames follow the `from`/`to` attributes.
 */
export type EmbedPanelData = Omit<PanelData, 'timeRange'> & { timeRange?: TimeRange };

export function panelDataFromFrames(frames: DataFrame[], timeRange?: TimeRange): EmbedPanelData {
  return { series: frames, state: LoadingState.Done, ...(timeRange ? { timeRange } : {}) };
}

/** Provider over frames the host already has. The default when a host sets `frames`. */
export function staticDataProvider(frames: DataFrame[]): EmbedDataProvider {
  return {
    subscribe(onData) {
      onData(panelDataFromFrames(frames));
      return () => {};
    },
  };
}
