import { assertAppPluginId } from './pluginMeta/apps';
import { assertDatasourcePluginId } from './pluginMeta/datasources';
import { assertPanelPluginId } from './pluginMeta/panels';
import { validatePluginId } from './pluginUtils';

export async function assertPluginId(pluginId = ''): Promise<void> {
  if (validatePluginId(pluginId)) {
    return;
  }

  try {
    await Promise.any([assertAppPluginId(pluginId), assertDatasourcePluginId(pluginId), assertPanelPluginId(pluginId)]);
  } catch {
    throw new Error(`Invalid plugin ID "${pluginId}"`);
  }
}
