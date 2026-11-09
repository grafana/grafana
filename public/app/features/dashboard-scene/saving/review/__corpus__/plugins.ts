import {
  type PanelPlugin,
  type PanelPluginMeta,
  PluginType,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { plugin as gauge } from 'app/plugins/panel/gauge/module';
import { plugin as piechart } from 'app/plugins/panel/piechart/module';
import { plugin as stat } from 'app/plugins/panel/stat/module';
import { plugin as timeseries } from 'app/plugins/panel/timeseries/module';

import { type CorpusPluginId } from './types';

// The app fills these registries at boot; stat and gauge need them to build their options and defaults.
initOnce(() => standardEditorsRegistry.setInit(getAllOptionEditors));
initOnce(() => standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs));

function initOnce(init: () => void) {
  try {
    init();
  } catch {
    // Already initialized by another import.
  }
}

// importPanelPlugin fills in `meta` from plugin.json when it loads a plugin; the bare modules have none.
const plugins: Record<CorpusPluginId, { plugin: PanelPlugin; name: string }> = {
  timeseries: { plugin: timeseries, name: 'Time series' },
  stat: { plugin: stat, name: 'Stat' },
  gauge: { plugin: gauge, name: 'Gauge' },
  piechart: { plugin: piechart, name: 'Pie chart' },
};

function withMeta(id: CorpusPluginId): PanelPlugin {
  const { plugin, name } = plugins[id];
  if (plugin.meta?.id !== id) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    plugin.meta = { ...plugin.meta, id, name, type: PluginType.panel, module: '', baseUrl: '' } as PanelPluginMeta;
  }
  return plugin;
}

/** The `getPlugin` a case's `plugins` list stands for: only the listed plugins count as loaded. */
export function getPluginLoader(ids: CorpusPluginId[] = []): (pluginId: string) => PanelPlugin | undefined {
  return (pluginId) => {
    const id = ids.find((candidate) => candidate === pluginId);
    return id ? withMeta(id) : undefined;
  };
}
