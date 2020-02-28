import { exec } from 'child_process';
import { getPluginJson } from '../../config/utils/pluginValidation';
import { getCiFolder } from '../../plugins/env';
import { getPluginId } from '../../config/utils/getPluginId';
import path = require('path');

const ciDir = getCiFolder();
const distDir = path.resolve(ciDir, 'dist');
const distContentDir = path.resolve(distDir, getPluginId());
const pluginJsonFile = path.resolve(distContentDir, 'plugin.json');
const pluginJson = getPluginJson(pluginJsonFile);

const execLine = async (command: string): Promise<string> => {
  if (command.length > 0) {
    return exec(command)
      .toString()
      .replace(/\r?\n|\r/g, '')
      .replace(/^\s+/g, '')
      .replace(/\s+$/g, '');
  }
  return '';
};

const getPluginVersion = (): string => {
  return pluginJson.info.version;
};

export { execLine, getPluginVersion, pluginJson };
