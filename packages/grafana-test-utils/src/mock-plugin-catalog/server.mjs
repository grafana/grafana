// Standalone mock of the grafana.com plugin catalog API for local/e2e testing.
//
// Grafana's Go backend reaches this over the network via GF_GRAFANA_COM_API_URL,
// so it must be a real HTTP server — MSW request interception can't satisfy the
// backend installer. Zero dependencies (built-in `http`). Plugin metadata is read
// at startup from each built plugin's dist/plugin.json, so it adapts to whatever
// ids @grafana/create-plugin produced (run make-zips.sh first).

import { createServer } from 'node:http';
import { createReadStream, readFileSync, readdirSync, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ZIPS_DIR = join(__dirname, 'zips');
const META_DIR = join(__dirname, 'meta');
const PORT = Number(process.env.PORT) || 8765;

// grafanaDependency is intentionally permissive so whatever Grafana version runs
// the test passes the compatibility filter. No sha256 -> the backend skips checksum
// verification (pkg/plugins/repo/client.go).
const VERSION = {
  version: '1.0.0',
  grafanaDependency: '>=0.0.0',
  isCompatible: true,
  packages: { any: { packageName: 'any', downloadUrl: '' } },
};

// Minimum fields mapRemoteToCatalog (public/app/features/plugins/admin/helpers.ts)
// reads for an installable, non-marketplace plugin.
function remoteMeta({ id, type, name }) {
  return {
    slug: id,
    id,
    typeCode: type,
    type,
    name,
    description: `Mock ${type} plugin for e2e install tests`,
    version: VERSION.version,
    orgName: 'Grafana Labs',
    status: 'active',
    popularity: 0,
    downloads: 0,
    internal: false,
    angularDetected: false,
    signatureType: '',
    versionSignatureType: '',
    versionSignedByOrgName: '',
    keywords: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    url: '',
  };
}

// The plugin sources are transient (scaffolded fresh on each make-zips run). Each
// plugin's real plugin.json is extracted to meta/<id>.json at build time and
// committed alongside its zips/<id>.zip, so the server just reads those files —
// no zip parsing, no runtime dependency on the sources.
function loadPlugins() {
  const plugins = new Map();
  if (!existsSync(META_DIR)) {
    return plugins;
  }
  for (const file of readdirSync(META_DIR)) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const { id, type, name } = JSON.parse(readFileSync(join(META_DIR, file), 'utf8'));
    plugins.set(id, { meta: remoteMeta({ id, type, name }), zipFile: `${id}.zip` });
  }
  return plugins;
}

const PLUGINS = loadPlugins();

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function streamZip(res, zipFile) {
  const zipPath = join(ZIPS_DIR, zipFile);
  try {
    await stat(zipPath);
  } catch {
    return json(res, 404, { message: `${zipFile} not found — run make-zips.sh first` });
  }
  res.writeHead(200, { 'content-type': 'application/zip' });
  createReadStream(zipPath).pipe(res);
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  const parts = pathname.split('/').filter(Boolean); // strip empty segments

  res.on('finish', () => {
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${res.statusCode} ${pathname}`);
  });

  // GET /plugins (+ any query) -> list all remote metas
  if (parts.length === 1 && parts[0] === 'plugins') {
    return json(res, 200, { items: [...PLUGINS.values()].map((p) => p.meta) });
  }

  if (parts[0] === 'plugins' && parts[1]) {
    const entry = PLUGINS.get(parts[1]);

    // GET /plugins/:id -> single remote meta
    if (parts.length === 2) {
      return entry ? json(res, 200, entry.meta) : json(res, 404, { message: 'Plugin not found' });
    }

    if (parts[2] === 'versions') {
      // GET /plugins/:id/versions and /plugins/:id/versions/:v -> one version
      // (empty items => the backend maps to 404, so gate on the plugin existing)
      if (parts.length === 3 || parts.length === 4) {
        return json(res, 200, { items: entry ? [VERSION] : [] });
      }
      // GET /plugins/:id/versions/:v/download -> stream the built zip
      if (parts.length === 5 && parts[4] === 'download') {
        if (!entry) {
          return json(res, 404, { message: 'Plugin not found' });
        }
        return streamZip(res, entry.zipFile);
      }
    }
  }

  // Safe superset — matches Grafana's offline behavior for unknown catalog routes.
  return json(res, 200, { items: [] });
});

server.listen(PORT, () => {
  const ids = [...PLUGINS.keys()];
  const url = `http://localhost:${PORT}`;
  /* eslint-disable no-console */
  console.log(`mock plugin catalog listening on ${url}`);
  if (ids.length === 0) {
    console.log('no plugins found — run make-zips.sh to build zips/ and meta/ first');
    return;
  }
  console.log(`serving ${ids.length} plugins: ${ids.join(', ')}`);
  console.log('\nrun Grafana against the mock with (export, so air/make respawns inherit it):\n');
  console.log(`  export GF_GRAFANA_COM_API_URL=${url}`);
  console.log(`  export GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=${ids.join(',')}`);
  console.log('  make run\n');
  /* eslint-enable no-console */
});
