import fs from 'fs';
import path from 'path';

import { PACKAGE_ROOT } from './variants.ts';

interface PackageJson {
  exports?: Record<string, unknown>;
}

function packageExportKey(groupName: string, version: string): string {
  return `./rtkq/${groupName}/${version}`;
}

export function hasPackageJsonExport(basePath: string, groupName: string, version: string): boolean {
  const packageJsonPath = path.join(basePath, `${PACKAGE_ROOT}/package.json`);
  const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  return Boolean(packageJson.exports?.[packageExportKey(groupName, version)]);
}

/** Add a new package.json export entry for the generated client. */
export function updatePackageJsonExports(basePath: string, groupName: string, version: string) {
  const packageJsonPath = path.join(basePath, `${PACKAGE_ROOT}/package.json`);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const subpath = `${groupName}/${version}`;
  const exportKey = packageExportKey(groupName, version);
  if (packageJson.exports[exportKey]) {
    console.log(`✅ Export for ${exportKey} already exists in package.json`);
    return;
  }

  packageJson.exports[exportKey] = {
    '@grafana-app/source': `./src/clients/rtkq/${subpath}/index.ts`,
    types: `./dist/types/clients/rtkq/${subpath}/index.d.ts`,
    import: `./dist/esm/clients/rtkq/${subpath}/index.mjs`,
    require: `./dist/cjs/clients/rtkq/${subpath}/index.cjs`,
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Added export for ${exportKey} to package.json`);
}
