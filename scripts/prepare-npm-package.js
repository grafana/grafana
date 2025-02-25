import PackageJson from '@npmcli/package-json';
import { mkdir } from 'node:fs/promises';

const cwd = process.cwd();

try {
  const pkgJson = await PackageJson.load(cwd);
  const cjsIndex = pkgJson.content.publishConfig?.main ?? pkgJson.content.main;
  const esmIndex = pkgJson.content.publishConfig?.module ?? pkgJson.content.module;
  const typesIndex = pkgJson.content.publishConfig?.types ?? pkgJson.content.types;
  const exports = {
    '.': {
      types: typesIndex,
      import: esmIndex,
      require: cjsIndex,
    },
    './package.json': './package.json',
  };

  pkgJson.update({
    main: cjsIndex,
    types: typesIndex,
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
  try {
    const pkgName = `${packageJsonContent.name}/${aliasName}`;
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
