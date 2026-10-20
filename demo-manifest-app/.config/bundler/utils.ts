import fs from 'fs';
import process from 'process';
import os from 'os';
import path from 'path';
import { glob } from 'glob';
import { SOURCE_DIR } from './constants.ts';

export function isWSL() {
  if (process.platform !== 'linux') {
    return false;
  }

  if (os.release().toLowerCase().includes('microsoft')) {
    return true;
  }

  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

function loadJson(path: string) {
  const rawJson = fs.readFileSync(path, 'utf8');
  return JSON.parse(rawJson);
}

export function getPackageJson() {
  return loadJson(path.resolve(process.cwd(), 'package.json'));
}

export function getPluginJson() {
  return loadJson(path.resolve(process.cwd(), `${SOURCE_DIR}/plugin.json`));
}

export function getCPConfigVersion() {
  const cprcJson = path.resolve(process.cwd(), './.config', '.cprc.json');
  return fs.existsSync(cprcJson) ? loadJson(cprcJson).version : { version: 'unknown' };
}

export function hasReadme() {
  return fs.existsSync(path.resolve(process.cwd(), SOURCE_DIR, 'README.md'));
}

// Support bundling nested plugins by finding all plugin.json files in src directory
// then checking for a sibling module.[jt]sx? file.
export async function getEntries() {
  const pluginsJson = await glob('**/src/**/plugin.json', { absolute: true });

  const plugins = await Promise.all(
    pluginsJson.map((pluginJson) => {
      const folder = path.dirname(pluginJson);
      return glob(`${folder}/module.{ts,tsx,js,jsx}`, { absolute: true });
    })
  );

  return plugins.reduce<Record<string, string>>((result, modules) => {
    return modules.reduce((innerResult, module) => {
      const pluginPath = path.dirname(module);
      const pluginName = path.relative(process.cwd(), pluginPath).replace(/src\/?/i, '');
      const entryName = pluginName === '' ? 'module' : `${pluginName}/module`;

      innerResult[entryName] = module;
      return innerResult;
    }, result);
  }, {});
}
