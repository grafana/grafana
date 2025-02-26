import PackageJson from '@npmcli/package-json';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const cwd = process.cwd();

try {
  const pkgJson = await PackageJson.load(cwd);
  const cjsIndex = pkgJson.content.publishConfig?.main ?? pkgJson.content.main;
  const esmIndex = pkgJson.content.publishConfig?.module ?? pkgJson.content.module;
  const cjsTypes = pkgJson.content.publishConfig?.types ?? pkgJson.content.types;
  const esmTypes = `./${join(dirname(esmIndex), 'index.d.mts')}`;

  const exports = {
    './package.json': './package.json',
    '.': {
      import: {
        types: esmTypes,
        default: esmIndex,
      },
      require: {
        types: cjsTypes,
        default: cjsIndex,
      },
    },
  };

  pkgJson.update({
    main: cjsIndex,
    types: cjsTypes,
    module: esmIndex,
    exports,
  });

  await pkgJson.save();

  if (process.env.ALIAS_PACKAGE_NAME) {
    const aliasName = process.env.ALIAS_PACKAGE_NAME;
    pkgJson.update({
      exports: {
        ...pkgJson.content.exports,
        [`./${aliasName}`]: {
          types: `./dist/${aliasName}.d.ts`,
          import: `./dist/esm/${aliasName}.js`,
          require: `./dist/${aliasName}.js`,
        },
      },
      files: [...pkgJson.content.files, aliasName],
    });
    await pkgJson.save();
    await createAliasPackageJsonFiles(pkgJson.content, aliasName);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}

async function createAliasPackageJsonFiles(packageJsonContent, aliasName) {
  const pkgName = `${packageJsonContent.name}/${aliasName}`;
  try {
    console.log(`📦 Writing alias package.json for ${pkgName}.`);
    const pkgJsonPath = `${cwd}/${aliasName}`;
    await mkdir(pkgJsonPath, { recursive: true });
    const pkgJson = await PackageJson.create(pkgJsonPath, {
      data: {
        name: pkgName,
        types: `../dist/${aliasName}.d.ts`,
        main: `../dist/${aliasName}.js`,
        module: `../dist/esm/${aliasName}.js`,
      },
    });
    await pkgJson.save();
  } catch (error) {
    console.error(`Error generating package.json for ${pkgName}`, error);
  }
}
