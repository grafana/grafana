/**
 * Static kubb config used by `scripts/codegen/gen-zod.ts`.
 *
 * gen-zod.ts handles the bits kubb can't:
 *   - walking apps/ to discover (app, version) targets
 *   - materializing a CUE wrapper subpackage so `cue def --out openapi` works
 *   - injecting OpenAPI 3.0 `discriminator` blocks (CUE doesn't emit them)
 *
 * It writes one OpenAPI JSON per target to a tmp dir, builds a manifest of
 * { inputPath, outputPath, banner }, and points kubb at this config via
 * `--config`. This file reads the manifest path from GEN_ZOD_MANIFEST and
 * returns one kubb pipeline per entry — kubb runs them all in a single
 * invocation.
 *
 * Do not invoke kubb against this file directly; use `make gen-zod` (or
 * `yarn ts-node --transpile-only scripts/codegen/gen-zod.ts`).
 */

import { defineConfig } from '@kubb/core';
import { pluginOas } from '@kubb/plugin-oas';
import { pluginZod } from '@kubb/plugin-zod';
import { readFileSync } from 'fs';

interface ManifestEntry {
  inputPath: string;
  outputPath: string;
  banner: string;
}

const manifestPath = process.env.GEN_ZOD_MANIFEST;
if (!manifestPath) {
  throw new Error('GEN_ZOD_MANIFEST must be set; this config is driven by scripts/codegen/gen-zod.ts');
}

const entries: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, 'utf8'));

export default defineConfig(
  entries.map(({ inputPath, outputPath, banner }) => ({
    root: '.',
    input: { path: inputPath },
    output: {
      path: outputPath,
      clean: true,
      format: false,
    },
    plugins: [
      pluginOas({ discriminator: 'inherit' }),
      pluginZod({ output: { path: '.', barrelType: 'named', banner } }),
    ],
  }))
);
