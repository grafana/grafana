import { execSync } from 'child_process';
import { getPluginJson } from '../../config/utils/pluginValidation';
import fs from 'fs';
import path = require('path');

const pluginJsonFile = path.resolve(`./src/plugin.json`);
const pluginJson = getPluginJson(pluginJsonFile);

const execLine = (command: string): string => {
  if (command.length > 0) {
    return execSync(command)
      .toString()
      .replace(/\r?\n|\r/g, '')
      .replace(/^\s+/g, '')
      .replace(/\s+$/g, '');
  }
  return '';
};

const getPluginVersion = (): string => {
  if (pluginJson.info.version === '%VERSION%') {
    return JSON.parse(fs.readFileSync(`./package.json`).toString())['version'];
  } else {
    return pluginJson.info.version;
  }
};

export { execLine, getPluginVersion, pluginJson };
