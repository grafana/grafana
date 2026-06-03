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

export function getPackageJson() {
  return loadJson(path.resolve(process.cwd(), 'package.json'));
}

export function getPluginJson() {
  return loadJson(path.resolve(process.cwd(), 'plugin.json'));
}

export async function getEntries(): Promise<Record<string, string>> {
  const cwd = process.cwd();
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

export function hasLicense() {
  return fs.existsSync(path.resolve(process.cwd(), 'LICENSE'));
}
