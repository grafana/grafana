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
    // Support @grafana/scenes that imports from dist/esm paths which webpack transforms to src paths
    // (see webpack.common.js NormalModuleReplacementPlugin that replaces @grafana/schema/dist/esm with @grafana/schema/src)
    exports['./src/*'] = {
      types: './src/*',
      default: './src/*',
    };
    // Add sub-path exports for dashboard v0
    exports['./dashboard/v0'] = {
      import: {
        types: './dist/types/schema/dashboard/v0/index.d.ts',
        default: './dist/esm/schema/dashboard/v0.mjs',
      },
      require: {
        types: './dist/types/schema/dashboard/v0/index.d.ts',
        default: './dist/cjs/schema/dashboard/v0.cjs',
      },
    };
    // Add sub-path exports for dashboard v2beta1
    exports['./dashboard/v2beta1'] = {
      import: {
        types: './dist/types/schema/dashboard/v2beta1/index.d.ts',
        default: './dist/esm/schema/dashboard/v2beta1.mjs',
      },
      require: {
        types: './dist/types/schema/dashboard/v2beta1/index.d.ts',
        default: './dist/cjs/schema/dashboard/v2beta1.cjs',
      },
    };

    // Add typesVersions for backwards compatibility with moduleResolution: "node"
    // This allows TypeScript to resolve types for sub-path imports even without
    // modern moduleResolution settings (bundler/node16/nodenext)
    pkgJson.update({
      typesVersions: {
        '*': {
          'dashboard/v0': ['./dist/types/schema/dashboard/v0/index.d.ts'],
          'dashboard/v2beta1': ['./dist/types/schema/dashboard/v2beta1/index.d.ts'],
        },
      },
    });
  }

  // Fix for @grafana/i18n so eslint-plugin can be imported by consumers
  if (pkgJson.content.name === '@grafana/i18n') {
    exports['./eslint-plugin'] = {
      types: './dist/eslint/index.d.ts',
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
    const aliasNames = process.env.ALIAS_PACKAGE_NAME.split(',');

    const additionalExports = aliasNames.reduce((acc, alias) => {
      acc[`./${alias}`] = {
        import: {
          types: typesIndex.replace('index', alias),
          default: esmIndex.replace('index', alias),
        },
        require: {
          types: typesIndex.replace('index', alias),
          default: cjsIndex.replace('index', alias),
        },
      };
      return acc;
    }, {});

    pkgJson.update({
      exports: {
        ...pkgJson.content.exports,
        ...additionalExports,
      },
      files: [...pkgJson.content.files, ...aliasNames],
    });
    await pkgJson.save();

    for await (const aliasName of aliasNames) {
      await createAliasPackageJsonFiles(pkgJson.content, aliasName);
    }
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
