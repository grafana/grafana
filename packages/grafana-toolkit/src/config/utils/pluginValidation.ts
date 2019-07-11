import path = require('path');

// See: packages/grafana-ui/src/types/plugin.ts
interface PluginJSONSchema {
  id: string;
  info: PluginMetaInfo;
}

interface PluginMetaInfo {
  version: string;
}

export const validatePluginJson = (pluginJson: any) => {
  if (!pluginJson.id) {
    throw new Error('Plugin id is missing in plugin.json');
  }

  if (!pluginJson.info) {
    throw new Error('Plugin info node is missing in plugin.json');
  }

  if (!pluginJson.info.version) {
    throw new Error('Plugin info.version is missing in plugin.json');
  }
};

export const getPluginJson = (root: string = process.cwd()): PluginJSONSchema => {
  let pluginJson;

  try {
    pluginJson = require(path.resolve(root, 'src/plugin.json'));
  } catch (e) {
    throw new Error('plugin.json file is missing!');
  }

  validatePluginJson(pluginJson);

  return pluginJson as PluginJSONSchema;
};
