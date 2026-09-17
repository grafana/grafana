import fs from 'fs';
import { glob } from 'fs/promises';
import path from 'path';
import process from 'process';

// Support for node 22 and 24. Due to the many changes in importing json files
// across recent node versions we load the json files using fs for simplicity.
function loadJson(path: string) {
  const rawJson = fs.readFileSync(path, 'utf8');
  return JSON.parse(rawJson);
}

export function getPackageJson(dir = process.cwd()) {
  return loadJson(path.resolve(dir, 'package.json'));
}

export function getPluginJson(dir = process.cwd()) {
  return loadJson(path.resolve(dir, 'plugin.json'));
}

export async function getEntries(dir = process.cwd()): Promise<Record<string, string>> {
  const cwd = dir;
  const result: Record<string, string> = {};

  for await (const pluginJson of glob('**/plugin.json', { cwd, exclude: ['**/dist/**'] })) {
    const folder = path.dirname(path.resolve(cwd, pluginJson));

    for await (const module of glob('module.{ts,tsx,js,jsx}', { cwd: folder })) {
      const modulePath = path.resolve(folder, module);
      const pluginName = path.relative(cwd, folder).replace(/src\/?/i, '');
      const entryName = pluginName === '' ? 'module' : `${pluginName}/module`;
      result[entryName] = modulePath;
    }
  }

  return result;
}

export function hasLicense(dir = process.cwd()) {
  return fs.existsSync(path.resolve(dir, 'LICENSE'));
}
