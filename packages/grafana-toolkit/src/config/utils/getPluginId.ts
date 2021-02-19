import path from 'path';

let PLUGIN_ID: string;

export const getPluginId = () => {
  if (!PLUGIN_ID) {
    const pluginJson = require(path.resolve(process.cwd(), 'src/plugin.json'));
    PLUGIN_ID = pluginJson.id;
  }
  return PLUGIN_ID;
};
