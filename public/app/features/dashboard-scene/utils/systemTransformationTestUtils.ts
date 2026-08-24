import { type DataFrame, FieldType, type PanelPlugin, type QueryResultMeta, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';

/**
 * The plugins each consumer's mocked importer resolves. Named with a `mock` prefix because a
 * `jest.mock` factory may only reference out-of-scope variables whose names start with `mock`, and
 * the factory is what has to read this map — `jest.mock` calls are hoisted per file, so they cannot
 * be shared, only the map they read from.
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
export const extractLabels = {
  id: 'extractFields',
  options: { format: 'json', keepTime: false, replace: false, source: 'labels' },
};

/** A frame with a JSON `labels` column, the shape {@link extractLabels} extracts fields out of. */
export function frameWithLabels(meta?: QueryResultMeta): DataFrame {
  return toDataFrame({
    name: 'logs',
    meta,
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200] },
      { name: 'line', type: FieldType.string, values: ['a', 'b'] },
      { name: 'labels', type: FieldType.string, values: ['{"level":"info"}', '{"level":"warn"}'] },
    ],
  });
}
