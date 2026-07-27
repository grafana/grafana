import { type Page, type Route } from '@playwright/test';

/**
 * A plugin as published on grafana.com, reduced to the fields the plugin catalog reads.
 */
export interface GcomPlugin {
  slug: string;
  name: string;
  type: 'app' | 'datasource' | 'panel';
  /**
   * Reported as the only (and therefore latest compatible) version. Installing a plugin still
   * downloads the real package through the Grafana backend, so this has to be a version that
   * exists on grafana.com.
   */
  version: string;
  grafanaDependency: string;
  description?: string;
}

// 1x1 transparent PNG, served for plugin logos so the catalog doesn't render broken images.
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Serves the grafana.com plugin API (proxied by Grafana under `/api/gnet`) from local fixtures.
 *
 * The plugin catalog blocks rendering on these requests, so tests that open `/plugins/:id` hang
 * until they resolve. Going to grafana.com for real makes those tests depend on the CI runner's
 * connectivity to it, which is where the flakiness comes from. Every `/api/gnet` request is
 * answered here, including for plugins not listed in `plugins` (grafana.com replies 404 for
 * plugins that were never published, such as the e2e test plugins).
 *
 * Call this before navigating.
 */
export async function mockGcomApi(page: Page, plugins: GcomPlugin[] = []): Promise<void> {
  const pluginsBySlug = new Map(plugins.map((plugin) => [plugin.slug, plugin]));

  await page.route(/\/api\/gnet\//, async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/api\/gnet/, '');

    if (path === '/plugins') {
      return fulfillJson(route, { items: plugins.map(toRemotePlugin) });
    }

    const [, slug, rest = ''] = path.match(/^\/plugins\/([^/]+)(\/.*)?$/) ?? [];
    const plugin = slug ? pluginsBySlug.get(slug) : undefined;

    if (!plugin) {
      return fulfillNotFound(route);
    }

    if (rest === '') {
      return fulfillJson(route, toRemotePlugin(plugin));
    }

    if (rest === '/versions') {
      return fulfillJson(route, { items: [toVersion(plugin)] });
    }

    if (rest === `/versions/${plugin.version}`) {
      return fulfillJson(route, toVersion(plugin));
    }

    if (/^\/versions\/[^/]+\/logos\/[^/]+$/.test(rest)) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PIXEL });
    }

    // Insights and entitlements are only available for a subset of plugins on grafana.com, and the
    // catalog treats a 404 as "no data" rather than as an error.
    return fulfillNotFound(route);
  });
}

function toRemotePlugin(plugin: GcomPlugin) {
  return {
    id: 0,
    slug: plugin.slug,
    name: plugin.name,
    description: plugin.description ?? plugin.name,
    typeCode: plugin.type,
    typeId: 0,
    typeName: plugin.type,
    version: plugin.version,
    versionStatus: 'active',
    versionSignatureType: 'grafana',
    versionSignedByOrg: 'grafana',
    versionSignedByOrgName: 'Grafana Labs',
    versionDistributionType: 'catalog',
    signatureType: 'grafana',
    status: 'active',
    statusContext: '',
    angularDetected: false,
    internal: false,
    verified: true,
    featured: 0,
    downloads: 0,
    downloadSlug: plugin.slug,
    popularity: 0,
    keywords: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    orgId: 0,
    orgName: 'Grafana Labs',
    orgSlug: 'grafana',
    orgUrl: 'https://grafana.com',
    url: 'https://grafana.com',
    userId: 0,
    changelog: '',
    readme: '',
    links: [],
    packages: {},
    managed: { enabled: false },
    json: { dependencies: { grafanaDependency: plugin.grafanaDependency, plugins: [] }, info: { links: [] } },
  };
}

function toVersion(plugin: GcomPlugin) {
  return {
    version: plugin.version,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isCompatible: true,
    grafanaDependency: plugin.grafanaDependency,
    angularDetected: false,
    status: 'active',
  };
}

function fulfillJson(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

function fulfillNotFound(route: Route) {
  return route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Not found' }),
  });
}
