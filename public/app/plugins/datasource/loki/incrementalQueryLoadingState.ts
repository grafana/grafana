import { LoadingState } from '@grafana/data';

/**
 * Loading state for incremental split-query responses.
 * Uses PartialResult when supported by the connected Grafana version; otherwise Streaming
 * so the plugin remains compatible with older Grafana instances.
 */
export function getIncrementalSplitQueryLoadingState(): LoadingState {
  if ('PartialResult' in LoadingState) {
    return LoadingState.PartialResult;
  }

  return LoadingState.Streaming;
}
