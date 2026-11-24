import { createRequire } from 'node:module';
import { basename } from 'node:path';
import type { Plugin } from 'rolldown';

import { createPackageConfig } from '../rolldown.config.parts';

const rq = createRequire(import.meta.url);
const pkg = rq('./package.json');

const legacyPrefix = './dist/esm/';

// Consumers on moduleResolution "node" ignore the exports map and resolve the legacy
// dist/esm/raw/composable/**/<Name>_types.gen paths as files, so emit a declaration at each one.
const legacyComposableTypes: Plugin = {
  name: 'legacy-composable-types',
  generateBundle(outputOptions) {
    if (outputOptions.format !== 'es' || !outputOptions.dir?.endsWith('dist/esm')) {
      return;
    }
    for (const [key, target] of Object.entries<{ import?: { default?: string } }>(pkg.exports)) {
      const esmFile = target.import?.default;
      if (!key.startsWith(`${legacyPrefix}raw/composable/`) || !esmFile) {
        continue;
      }
      this.emitFile({
        type: 'asset',
        fileName: `${key.slice(legacyPrefix.length)}.d.ts`,
        source: `export * from './${basename(esmFile)}';\n`,
      });
    }
  },
};

export default createPackageConfig({ plugins: [legacyComposableTypes] });
