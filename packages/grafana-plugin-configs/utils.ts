import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import process from 'process';

export function getPackageJson() {
  return require(path.resolve(process.cwd(), 'package.json'));
}

export function getPluginJson() {
  return require(path.resolve(process.cwd(), 'plugin.json'));
}

export async function getEntries(): Promise<Record<string, string>> {
  const pluginModules = await glob(path.resolve(process.cwd(), `module.{ts,tsx}`), { absolute: true });
  if (pluginModules.length > 0) {
    return {
      module: pluginModules[0],
    };
  }
  throw new Error('Could not find module.ts or module.tsx file');
}

export function hasLicense() {
  return fs.existsSync(path.resolve(process.cwd(), 'LICENSE'));
}
