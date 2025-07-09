import fs from 'fs';
import { glob } from 'glob';
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
  const pluginsJson = await glob(path.resolve(process.cwd(), '**/plugin.json'), {
    ignore: ['**/dist/**'],
    absolute: true,
  });

  const plugins = await Promise.all(
    pluginsJson.map((pluginJson) => {
      const folder = path.dirname(pluginJson);
      return glob(`${folder}/module.{ts,tsx,js,jsx}`, { absolute: true });
    })
  );

  let result: Record<string, string> = {};
  return plugins.reduce((result, modules) => {
    return modules.reduce((result, module) => {
      const pluginPath = path.dirname(module);
      const pluginName = path.relative(process.cwd(), pluginPath).replace(/src\/?/i, '');
      const entryName = pluginName === '' ? 'module' : `${pluginName}/module`;

      result[entryName] = module;
      return result;
    }, result);
  }, result);
}

export function hasLicense() {
  return fs.existsSync(path.resolve(process.cwd(), 'LICENSE'));
}
