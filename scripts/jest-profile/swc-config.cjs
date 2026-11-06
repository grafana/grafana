const { createRequire } = require('node:module');
const path = require('node:path');

function swcOptions(parser) {
  return {
    swcrc: false,
    configFile: false,
    sourceMaps: true,
    module: { type: 'commonjs' },
    jsc: {
      target: 'es2018',
      parser: { ...parser, decorators: true },
      transform: {
        legacyDecorator: true,
        useDefineForClassFields: false,
        react: { runtime: 'automatic', development: false },
      },
    },
  };
}

function resolveTransform(rootDir, transformer, swcJest, sucraseJest) {
  if (!['ts-jest', 'swc', 'swc-mutable', 'sucrase'].includes(transformer)) {
    throw new Error('--transformer must be ts-jest, swc, swc-mutable, or sucrase.');
  }
  if (swcJest && !['swc', 'swc-mutable'].includes(transformer)) {
    throw new Error('--swc-jest requires --transformer=swc or swc-mutable.');
  }
  if (sucraseJest && transformer !== 'sucrase') throw new Error('--sucrase-jest requires --transformer=sucrase.');
  if (transformer === 'ts-jest') return { overrides: {}, metadata: { name: 'ts-jest' } };
  if (transformer === 'sucrase') {
    const adapter = resolveAdapter(rootDir, '@sucrase/jest-plugin', sucraseJest, '--sucrase-jest');
    const adapterRequire = createRequire(adapter);
    return {
      overrides: {
        transform: {
          '^.+\\.(ts|tsx|js|jsx)$': [adapter, { jsxRuntime: 'automatic', production: true, disableESTransforms: false, preserveDynamicImport: false }],
        },
      },
      metadata: {
        name: transformer, adapter,
        jestAdapterVersion: adapterRequire('@sucrase/jest-plugin/package.json').version,
        coreVersion: adapterRequire('sucrase/package.json').version,
      },
    };
  }
  const adapter = resolveAdapter(rootDir, '@swc/jest', swcJest, '--swc-jest');
  const adapterRequire = createRequire(adapter);
  let plugin;
  if (transformer === 'swc-mutable') {
    try {
      plugin = adapterRequire.resolve('@swc-contrib/mut-cjs-exports');
    } catch (cause) {
      throw new Error('Cannot resolve @swc-contrib/mut-cjs-exports from the SWC adapter. Install a plugin version compatible with your SWC core alongside the adapter.', { cause });
    }
  }
  const options = (parser) => {
    const value = swcOptions(parser);
    if (plugin) value.jsc.experimental = { plugins: [[plugin, {}]] };
    return value;
  };
  return {
    overrides: {
      transform: {
        '^.+\\.ts$': [adapter, options({ syntax: 'typescript', tsx: false })],
        '^.+\\.tsx$': [adapter, options({ syntax: 'typescript', tsx: true })],
        '^.+\\.jsx?$': [adapter, options({ syntax: 'ecmascript', jsx: true })],
      },
    },
    metadata: {
      name: transformer, adapter,
      jestAdapterVersion: adapterRequire('./package.json').version,
      coreVersion: adapterRequire('@swc/core/package.json').version,
      ...(plugin ? { plugin, pluginVersion: createRequire(plugin)('./package.json').version } : {}),
    },
  };
}

function resolveAdapter(rootDir, name, explicitPath, flag) {
  const rootRequire = createRequire(path.join(rootDir, 'package.json'));
  let adapter;
  try {
    adapter = rootRequire.resolve(explicitPath ? path.resolve(rootDir, explicitPath) : name);
  } catch (cause) {
    throw new Error(`Cannot resolve ${name}. Install the experimental dependencies separately and supply ${flag}=path/to/${name}.`, { cause });
  }
  return adapter;
}

module.exports = { resolveTransform, swcOptions };
