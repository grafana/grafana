//@ts-check
import PackageJson from '@npmcli/package-json';
import { mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { inspect } from 'node:util';

const cwd = process.cwd();

try {
  const pkgJson = await PackageJson.load(cwd);
  const pkgJsonExports = pkgJson.content.exports ?? {};

  // Aliasable exports point to a separate entry point. The following should not be aliased:
  // - ./package.json
  // - .
  // - ./index
  // - Wildcard exports
  // - exports with a single key '@grafana-app/source'
  const aliasableExports = Object.entries(pkgJsonExports).reduce((acc, [key, val]) => {
    if (key === './package.json' || key === '.' || key === './index' || key.endsWith('*')) {
      return acc;
    }

    if (
      val !== null &&
      typeof val === 'object' &&
      Object.keys(val).length === 1 &&
      Object.keys(val)[0] === '@grafana-app/source'
    ) {
      return acc;
    }

    acc[key] = val;
    return acc;
  }, {});

  // For backwards compatibility generate additional "nested" package.json for
  // typescript resolutions that don't support exports. e.g. node10.
  for (const [aliasName, pkgJsonExport] of Object.entries(aliasableExports)) {
    await createAliasPackageJsonFiles(pkgJson.content, aliasName, pkgJsonExport);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}

async function createAliasPackageJsonFiles(packageJsonContent, aliasName, pkgJsonExport) {
  const pkgName = join(packageJsonContent.name, aliasName);
  try {
    console.log(`📦 Writing alias package.json for ${pkgName}.`);
    const pkgJsonPath = join(cwd, aliasName);
    await mkdir(pkgJsonPath, { recursive: true });
    let pkgJson;

    if (typeof pkgJsonExport === 'string') {
      pkgJson = await PackageJson.create(pkgJsonPath, {
        data: {
          name: pkgName,
          main: relative(pkgJsonPath, pkgJsonExport),
        },
      });
    } else {
      pkgJson = await PackageJson.create(pkgJsonPath, {
        data: {
          name: pkgName,
          types: relative(pkgJsonPath, pkgJsonExport.types),
          main: relative(pkgJsonPath, pkgJsonExport.require),
          module: relative(pkgJsonPath, pkgJsonExport.import),
        },
      });
    }

    await pkgJson.save();
  } catch (error) {
    throw new Error(`Error generating package.json for ${pkgName}`, error);
  }
}
