import { Task, TaskRunner } from './task';
import fs from 'fs';
import path from 'path';
import execa from 'execa';
import { ManifestInfo } from '../../plugins/types';

interface ManifestOptions {
  folder: string;
}

export function getFilesForManifest(root: string, work?: string, acc?: string[]): string[] {
  if (!acc) {
    acc = [];
  }
  let abs = work ?? root;
  const files = fs.readdirSync(abs);
  files.forEach(file => {
    const f = path.join(abs, file);
    const stat = fs.statSync(f);
    if (stat.isDirectory()) {
      acc = getFilesForManifest(root, f, acc);
    } else {
      const idx = f.lastIndexOf('.');
      if (idx > 0) {
        // Don't hash images
        const suffix = f.substring(idx + 1).toLowerCase();
        if (suffix === 'png' || suffix == 'gif' || suffix === 'svg') {
          return;
        }
      }
      acc!.push(f.substring(root.length + 1).replace('\\', '/'));
    }
  });
  return acc;
}

export function convertSha1SumsToManifest(sums: string): ManifestInfo {
  const files: Record<string, string> = {};
  for (const line of sums.split(/\r?\n/)) {
    const idx = line.indexOf(' ');
    if (idx > 0) {
      const hash = line.substring(0, idx).trim();
      const path = line.substring(idx + 1).trim();
      files[path] = hash;
    }
  }
  return {
    plugin: '<?>',
    version: '<?>',
    files,
  };
}

const manifestRunner: TaskRunner<ManifestOptions> = async ({ folder }) => {
  const GRAFANA_API_KEY = process.env.GRAFANA_API_KEY;
  if (!GRAFANA_API_KEY) {
    console.log('Plugin signing requires a grafana API key');
  }
  const filename = 'MANIFEST.txt';
  const files = getFilesForManifest(folder).filter(f => f !== filename);

  // Run sha1sum
  const originalDir = __dirname;
  process.chdir(folder);
  const { stdout } = await execa('sha1sum', files);
  process.chdir(originalDir);

  // Send the manifest to grafana API
  const manifest = convertSha1SumsToManifest(stdout);
  const outputPath = path.join(folder, filename);

  const pluginPath = path.join(folder, 'plugin.json');
  const plugin = require(pluginPath);
  const url = `https://grafana.com/api/plugins/${plugin.id}/ci/sign`;
  manifest.plugin = plugin.id;
  manifest.version = plugin.version;
  if (!plugin.version) {
    console.error('Missing Vection', plugin);
  }

  console.log('Request Signature:', url, manifest);
  const axios = require('axios');

  try {
    const info = await axios.post(url, manifest, {
      headers: { Authorization: 'Bearer ' + GRAFANA_API_KEY },
      responseType: 'arraybuffer',
    });
    if (info.status === 200) {
      console.log('OK: ', info.data);
      const buffer = new Buffer(info.data, 'binary');
      fs.writeFileSync(outputPath, buffer);
    } else {
      console.warn('Error: ', info);
      console.log('Saving the unsigned manifest');
      fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    }
  } catch (err) {
    console.log('ERROR Fetching response', err);
  }
};

export const manifestTask = new Task<ManifestOptions>('Build Manifest', manifestRunner);
