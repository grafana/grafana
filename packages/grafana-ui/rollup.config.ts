import PackageJson from '@npmcli/package-json';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { Plugin } from 'rollup';
import copy from 'rollup-plugin-copy';
import svg from 'rollup-plugin-svg-import';

import { cjsOutput, entryPoint, esmOutput, plugins, tsDeclarationOutput } from '../rollup.config.parts';

const rq = createRequire(import.meta.url);
const icons = rq('../../public/app/core/icons/cached.json');
const pkg = rq('./package.json');

const iconSrcPaths = icons.map((iconSubPath) => {
  return `../../public/img/icons/${iconSubPath}.svg`;
});

export default [
  {
    input: entryPoint,
    plugins: [
      ...plugins,
      svg({ stringify: true }),
      copy({
        targets: [{ src: iconSrcPaths, dest: './dist/public/' }],
        flatten: false,
      }),
    ],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-ui')],
  },
  {
    input: 'src/unstable.ts',
    plugins: [
      ...plugins,
      svg({ stringify: true }),
      copy({
        targets: [{ src: iconSrcPaths, dest: './dist/public/' }],
        flatten: false,
      }),
      generateAliasPackageJson({ alias: 'unstable' }),
    ],
    output: [cjsOutput(pkg), esmOutput(pkg, 'grafana-ui')],
  },
  tsDeclarationOutput(pkg),
  tsDeclarationOutput(pkg, {
    input: './compiled/unstable.d.ts',
    output: {
      file: './dist/unstable.d.ts',
      format: 'es',
    },
  }),
];

interface RollupAliasPkgJsonOptions {
  alias: string;
}

// This rollup plugin allows the generation of "nested" package.json files to alias bare specifiers so they resolve
// to the correct location on the file system. This is handy for skipping `dist` directories in imports.
// e.g. import { attachSkeleton } from '@grafana/ui/unstable' rather than '@grafana/ui/dist/unstable'.
function generateAliasPackageJson(options: RollupAliasPkgJsonOptions): Plugin {
  const { alias }: Required<RollupAliasPkgJsonOptions> = options;
  return {
    name: 'generate-alias-package-json',
    async writeBundle() {
      const aliasName = `@grafana/ui/${alias}`;
      console.log(`📦 Writing alias package.json for ${alias}.`);
      const pkgJsonPath = `./${alias}`;
      await mkdir(pkgJsonPath, { recursive: true });
      const pkgJson = await PackageJson.create(pkgJsonPath, {
        data: {
          name: aliasName,
          types: `../dist/${alias}.d.ts`,
          main: `../dist/${alias}.js`,
          module: `../dist/esm/${alias}.js`,
        },
      });

      await pkgJson.save();
    },
  };
}
