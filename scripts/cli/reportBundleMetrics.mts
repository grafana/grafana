import path, { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readBundleSizes } from './bundleMetrics/bundleSizes.mts';
import { readRsdoctorMetrics } from './bundleMetrics/rsdoctor.mts';

const REPO_ROOT = path.resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function main() {
  const [firstArgument, secondArgument] = process.argv.slice(2);
  const sizesOnly = firstArgument === '--sizes-only';
  const buildDirectory = path.resolve(REPO_ROOT, (sizesOnly ? secondArgument : firstArgument) || 'public/build');

  const sizeMetrics = await readBundleSizes(buildDirectory, { includeRspack: !sizesOnly });
  for (const [name, value] of Object.entries(sizeMetrics)) {
    console.log(`${sizesOnly ? '' : 'bundleSize.'}${name} ${value}`);
  }

  if (sizesOnly) {
    return;
  }

  const rsdoctorMetrics = await readRsdoctorMetrics(path.join(buildDirectory, 'rspack', '.rsdoctor'));
  for (const [name, value] of Object.entries(rsdoctorMetrics)) {
    console.log(`build.rspack.${name} ${value}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
