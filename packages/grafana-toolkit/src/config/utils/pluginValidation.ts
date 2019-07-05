import path = require('path');

interface PluginJSONSchema {
  id: string;
}

export const validatePluginJson = (pluginJson: any) => {
  if (!pluginJson.id) {
    throw new Error('Plugin id is missing in plugin.json');
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
