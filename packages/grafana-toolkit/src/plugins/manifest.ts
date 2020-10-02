import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ManifestInfo } from './types';

const MANIFEST_FILE = 'MANIFEST.txt';

async function* walk(dir: string, baseDir: string): AsyncGenerator<string, any, any> {
  for await (const d of await (fs.promises as any).opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) {
      yield* await walk(entry, baseDir);
    } else if (d.isFile()) {
      yield path.relative(baseDir, entry);
    } else if (d.isSymbolicLink()) {
      const realPath = fs.realpathSync(entry);
      if (!realPath.startsWith(baseDir)) {
        throw new Error(
          `symbolic link ${path.relative(baseDir, entry)} targets a file outside of the base directory: ${baseDir}`
        );
      }
      yield path.relative(baseDir, entry);
    }
  }
}

export async function buildManifest(dir: string): Promise<ManifestInfo> {
  const pluginJson = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), { encoding: 'utf8' }));

  const manifest = {
    plugin: pluginJson.id,
    version: pluginJson.info.version,
    files: {},
  } as ManifestInfo;

  for await (const p of await walk(dir, dir)) {
    if (p === MANIFEST_FILE) {
      continue;
    }

    manifest.files[p] = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(dir, p)))
      .digest('hex');
  }

  return manifest;
}

export async function signManifest(manifest: ManifestInfo): Promise<string> {
  const GRAFANA_API_KEY = process.env.GRAFANA_API_KEY;
  if (!GRAFANA_API_KEY) {
    throw new Error('You must enter a GRAFANA_API_KEY to sign the plugin manifest');
  }

  const GRAFANA_COM_URL = process.env.GRAFANA_COM_URL || 'https://grafana.com/api';
  const url = GRAFANA_COM_URL + '/plugins/ci/sign';

  const axios = require('axios');

  try {
    const info = await axios.post(url, manifest, {
      headers: { Authorization: 'Bearer ' + GRAFANA_API_KEY },
    });
    if (info.status !== 200) {
      console.warn('Error: ', info);
      throw new Error('Error signing manifest');
    }

    return info.data;
  } catch (err) {
    if ((err.response && err.response.data) || err.response.data.message) {
      throw new Error('Error signing manifest: ' + err.response.data.message);
    }

    throw new Error('Error signing manifest: ' + err.message);
  }
}

export async function saveManifest(dir: string, signedManifest: string): Promise<boolean> {
  fs.writeFileSync(path.join(dir, MANIFEST_FILE), signedManifest);
  return true;
}
