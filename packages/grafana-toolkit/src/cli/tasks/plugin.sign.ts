import path from 'path';
import { buildManifest, signManifest, saveManifest } from '../../plugins/manifest';
import { Task, TaskRunner } from './task';
import { promises as fs } from 'fs';
interface PluginSignOptions {
  signatureType?: string;
  rootUrls?: string[];
}

const pluginSignRunner: TaskRunner<PluginSignOptions> = async ({ signatureType, rootUrls }) => {
  const distContentDir = path.resolve('dist');

  try {
    console.log('Building manifest...');
    const manifest = await buildManifest(distContentDir);
    // console.log(manifest);

    console.log('Signing manifest...');
    if (signatureType) {
      manifest.signatureType = signatureType;
    }
    if (rootUrls) {
      manifest.rootUrls = rootUrls;
    }

    const pkg = await fs.readFile(`${__dirname}/../../../package.json`, 'utf8');
    const { version } = JSON.parse(pkg);
    manifest.toolkit = { version };
    const signedManifest = await signManifest(manifest);

    console.log('Saving signed manifest...');
    await saveManifest(distContentDir, signedManifest);

    console.log('Signed successfully');
  } catch (err) {
    console.warn(err);
  }
};

export const pluginSignTask = new Task<PluginSignOptions>('plugin:sign task', pluginSignRunner);
