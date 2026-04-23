#!/usr/bin/env node
// Renders a static index.html for the Meticulous frontend-only container.
//
// Bootdata is recorded on live Grafana via window.Meticulous.record.recordCustomData
// (see public/views/index.html) and retrieved here at replay time via
// window.Meticulous.replay.retrieveCustomData. Only the assets field — JS/CSS
// bundle paths, which are hash-based and build-specific — is supplied by this
// script from the build-time manifest.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [, , manifestPathArg, outPathArg] = process.argv;
if (!manifestPathArg || !outPathArg) {
  console.error('usage: render-index.mjs <assets-manifest.json> <out-index.html>');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(resolve(manifestPathArg), 'utf8'));

const integrityByPath = Object.create(null);
for (const v of Object.values(manifest)) {
  if (v && typeof v === 'object' && v.src && v.integrity) {
    integrityByPath[v.src] = v.integrity;
  }
}

const entry = manifest.entrypoints;
if (!entry?.app?.assets?.js?.length) {
  throw new Error('missing app.js entries in assets-manifest (did yarn build run?)');
}
if (!entry?.dark?.assets?.css?.length || !entry?.light?.assets?.css?.length) {
  throw new Error('missing dark/light css entries in assets-manifest');
}

const jsFiles = entry.app.assets.js.map((filePath) => ({
  filePath,
  integrity: integrityByPath[filePath] ?? '',
}));
const cssFiles = entry.app.assets.css.map((filePath) => ({
  filePath,
  integrity: integrityByPath[filePath] ?? '',
}));

// Match pkg/api/dtos.EntryPointAssets JSON shape. Overrides whatever `assets`
// was in the recorded bootdata — those hashes are stale by definition.
const assets = {
  jsFiles,
  cssFiles,
  dark: entry.dark.assets.css[0],
  light: entry.light.assets.css[0],
  swagger: (entry.swagger?.assets?.js ?? []).map((filePath) => ({
    filePath,
    integrity: integrityByPath[filePath] ?? '',
  })),
  swaggerCssFiles: (entry.swagger?.assets?.css ?? []).map((filePath) => ({
    filePath,
    integrity: integrityByPath[filePath] ?? '',
  })),
};

const cssLinks = cssFiles
  .map((a) => `    <link rel="stylesheet" href="/${a.filePath}" />`)
  .join('\n');

const jsScripts = jsFiles
  .map((a) => `    <script src="/${a.filePath}" type="text/javascript" defer></script>`)
  .join('\n');

// Keep </script> literals inside the JSON safe for HTML parsing.
const safeJSON = (value) => JSON.stringify(value).replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta name="viewport" content="width=device-width" />
    <meta name="theme-color" content="#000" />

    <title>Grafana</title>

    <base href="/" />

    <link rel="icon" type="image/png" href="/public/img/fav32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/public/img/apple-touch-icon.png" />
    <link rel="mask-icon" href="/public/img/grafana_mask_icon.svg" color="#F05A28" />

${cssLinks}
    <link rel="stylesheet" href="/${assets.dark}" />

    <script src="https://snippet.meticulous.ai/v1/meticulous.js" data-token="ceD9Uoa4XN0ST1SjIHfzgAgYrK0WrKQzJ4QTTsrZ"></script>

    <script>
      performance.mark('frontend_boot_css_time_seconds');
    </script>
  </head>

  <body class="theme-dark">
    <div id="reactRoot"></div>

    <script>
      // Bootdata is recorded on live Grafana via recordCustomData (see
      // public/views/index.html) and restored here. Fresh assets are merged
      // in from the build manifest, since recorded hashes are stale.
      var assets = ${safeJSON(assets)};
      var recorded = window.Meticulous && window.Meticulous.replay
        ? window.Meticulous.replay.retrieveCustomData('grafanaBootData')
        : null;
      if (!recorded) {
        throw new Error('Meticulous replay did not provide grafanaBootData custom value');
      }
      var bootData = JSON.parse(recorded);
      bootData.assets = assets;
      window.grafanaBootData = bootData;
      // Monolith index.html contract: public/app/index.ts awaits this promise.
      window.__grafana_boot_data_promise = Promise.resolve();
      window.__grafana_app_bundle_loaded = false;
    </script>

${jsScripts}

    <script>
      performance.mark('frontend_boot_js_done_time_seconds');
    </script>
  </body>
</html>
`;

const outPath = resolve(outPathArg);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${jsFiles.length} js, ${cssFiles.length} css)`);
