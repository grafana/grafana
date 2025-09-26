import PackageJson from '@npmcli/package-json';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const cwd = process.cwd();

try {
  const pkgJson = await PackageJson.load(cwd);
  const pkgJsonExports = pkgJson.content.exports ?? {};

  // The "internal" export is not for public consumption
  if (pkgJsonExports && pkgJsonExports['./internal']) {
    delete pkgJsonExports['./internal'];
  }

  pkgJson.update({
    exports: pkgJsonExports,
  });

  await pkgJson.save();

  // For every export in the package.json we generate an additional "nested" package.json
  // to hack around typescript resolutions that don't support exports. e.g. node10.
  for (const [aliasName, pkgJsonExport] of Object.entries(pkgJsonExports)) {
    await createAliasPackageJsonFiles(pkgJson.content, aliasName, pkgJsonExport);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}

async function createAliasPackageJsonFiles(packageJsonContent, aliasName, pkgJsonExport) {
  const pkgName = `${packageJsonContent.name}/${aliasName}`;
  try {
    console.log(`📦 Writing alias package.json for ${pkgName}.`);
    const pkgJsonPath = join(cwd, aliasName);
    await mkdir(pkgJsonPath, { recursive: true });
    const pkgJson = await PackageJson.create(pkgJsonPath, {
      data: {
        name: pkgName,
        types: pkgJsonExport.require.types,
        main: pkgJsonExport.require.default,
        module: pkgJsonExport.import.default,
      },
    });
    await pkgJson.save();
  } catch (error) {
    throw new Error(`Error generating package.json for ${pkgName}`, error);
  }
}
