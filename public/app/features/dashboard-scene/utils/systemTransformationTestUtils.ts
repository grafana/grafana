import {
  type DataFrame,
  DataTransformerID,
  FieldType,
  type PanelPlugin,
  type QueryResultMeta,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import {
  DATAPLANE_LABELS_NAME,
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
} from 'app/features/logs/logsFrame';

/**
 * The plugins that each consumer's mocked importer resolves.
 */
export const mockSystemTransformationPlugins = new Map<string, PanelPlugin>();

/**
 * The scenes-side counterpart to the importer mock: what `VizPanel.getPlugin` resolves through.
 * Pass it to `setPluginImportUtils` once per test file.
 */
export const systemTransformationPluginImportUtils = {
  importPanelPlugin: (id: string) => Promise.resolve(mockSystemTransformationPlugins.get(id)!),
  getPanelPluginFromCache: (id: string) => mockSystemTransformationPlugins.get(id),
};

export function registerPlugin(id: string, configure?: (plugin: PanelPlugin) => void) {
  const plugin = getPanelPlugin({ id });
  configure?.(plugin);
  mockSystemTransformationPlugins.set(id, plugin);
  return plugin;
}

/** The transformation a logs table registers to turn its JSON `labels` column into fields. */
export const EXTRACT_FIELDS_FIXTURE = {
  id: DataTransformerID.extractFields,
  options: { format: 'json', keepTime: false, replace: false, source: DATAPLANE_LABELS_NAME },
};

/** A frame with a JSON `labels` column, the shape {@link EXTRACT_FIELDS_FIXTURE} extracts fields out of. */
export function frameWithLabels(meta?: QueryResultMeta): DataFrame {
  return toDataFrame({
    name: 'logs',
    meta,
    fields: [
      { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [100, 200] },
      { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['a', 'b'] },
      { name: DATAPLANE_LABELS_NAME, type: FieldType.string, values: ['{"level":"info"}', '{"level":"warn"}'] },
    ],
  });
}
