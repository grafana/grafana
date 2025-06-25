import PackageJson from '@npmcli/package-json';
import { mkdir } from 'node:fs/promises';

const cwd = process.cwd();

try {
  const pkgJson = await PackageJson.load(cwd);
  const cjsIndex = pkgJson.content.publishConfig?.main ?? pkgJson.content.main;
  const esmIndex = pkgJson.content.publishConfig?.module ?? pkgJson.content.module;
  const typesIndex = pkgJson.content.publishConfig?.types ?? pkgJson.content.types;

  const exports = {
    './package.json': './package.json',
    '.': {
      import: {
        types: typesIndex,
        default: esmIndex,
      },
      require: {
        types: typesIndex,
        default: cjsIndex,
      },
    },
  };
  // Fix so scenes can access `@grafana/schema` nested dist import paths e.g.
  // import {} from '@grafana/schema/dist/esm/raw/composable/bargauge/panelcfg/x/BarGaugePanelCfg_types.gen'
  if (pkgJson.content.name === '@grafana/schema') {
    exports['./dist/*'] = {
      types: './dist/*',
      default: './dist/*',
    };
  }

  // Fix for @grafana/i18n so eslint-plugin can be imported by consumers
  if (pkgJson.content.name === '@grafana/i18n') {
    exports['./eslint-plugin'] = {
      import: './dist/eslint/index.cjs',
      require: './dist/eslint/index.cjs',
    };
  }

  pkgJson.update({
    main: cjsIndex,
    types: typesIndex,
    module: esmIndex,
    exports,
  });

  await pkgJson.save();

  // If an alias package name is provided we add an exports entry for the alias
  // then generate an additional "nested" package.json for typescript resolution that
  // doesn't use the exports property in package.json.
  if (process.env.ALIAS_PACKAGE_NAME) {
    const aliasName = process.env.ALIAS_PACKAGE_NAME;
    pkgJson.update({
      exports: {
        ...pkgJson.content.exports,
        [`./${aliasName}`]: {
          import: {
            types: typesIndex.replace('index', aliasName),
            default: esmIndex.replace('index', aliasName),
          },
          require: {
            types: typesIndex.replace('index', aliasName),
            default: cjsIndex.replace('index', aliasName),
          },
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
        types: `../dist/types/${aliasName}.d.ts`,
        main: `../dist/cjs/${aliasName}.cjs`,
        module: `../dist/esm/${aliasName}.mjs`,
      },
    });
    await pkgJson.save();
  } catch (error) {
    throw new Error(`Error generating package.json for ${pkgName}`, error);
  }
}
