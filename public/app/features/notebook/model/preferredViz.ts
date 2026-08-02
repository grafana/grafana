import { isTimeSeriesFrames, type PanelData } from '@grafana/data';

/**
 * Picks the visualization that makes the most sense for returned data, using the
 * frames' own metadata (same approach as the saved-queries inline editor):
 * 1. an explicit preferred panel plugin declared by the datasource on the frame meta,
 * 2. the preferred visualisation type (logs, traces, node graph, flame graph, ...),
 * 3. time series heuristic, falling back to table for anything not graphable.
 */
export function preferredVizForData(data: PanelData): string {
  const frames = data.series;

  const preferredPluginId = frames.find((frame) => frame.meta?.preferredVisualisationPluginId)?.meta
    ?.preferredVisualisationPluginId;
  if (preferredPluginId) {
    return preferredPluginId;
  }

  const preferredType = frames.find((frame) => frame.meta?.preferredVisualisationType)?.meta
    ?.preferredVisualisationType;
  switch (preferredType) {
    case 'graph':
      return 'timeseries';
    case 'logs':
      return 'logs';
    case 'trace':
      return 'traces';
    case 'nodeGraph':
      return 'nodeGraph';
    case 'flamegraph':
      return 'flamegraph';
    case 'table':
    case 'rawPrometheus':
      return 'table';
  }

  return isTimeSeriesFrames(frames) ? 'timeseries' : 'table';
}
