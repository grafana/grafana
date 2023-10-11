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

// Support bundling nested plugins by finding all plugin.json files in src directory
// then checking for a sibling module.[jt]sx? file.
export async function getEntries(): Promise<Record<string, string>> {
  const pluginsJson = await glob(path.resolve(process.cwd(), `module.{ts,tsx}`));
  if (pluginsJson.length > 0) {
    return {
      module: pluginsJson[0],
    };
  }
  throw new Error('Could not find module.ts or module.tsx file');
}

export function hasLicense() {
  return fs.existsSync(path.resolve(process.cwd(), 'LICENSE'));
}
