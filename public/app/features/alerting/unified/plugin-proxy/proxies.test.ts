import { mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { SupportedPlugin } from '../types/pluginBridges';

import { routeProxies } from './proxies';
import { resolveProxyTarget } from './resolve';

const PLUGIN_BASE = `/a/${SupportedPlugin.PrometheusAlerting}`;

const MIMIR_NAME = 'Mimir';
const MIMIR_UID = 'mimir-uid';
const ALERTMANAGER_NAME = 'External AM';
const ALERTMANAGER_UID = 'external-am-uid';

beforeEach(() => {
  setupDataSources(
    mockDataSource({ name: MIMIR_NAME, uid: MIMIR_UID, type: 'prometheus' }),
    mockDataSource({ name: ALERTMANAGER_NAME, uid: ALERTMANAGER_UID, type: 'alertmanager' })
  );
});

/** Runs the proxy registered for `routePath` against a URL, the same way the route wrapper does. */
function resolve(routePath: string, url: string): Promise<string | undefined> {
  const proxy = routeProxies.find(({ path }) => path === routePath);
  if (!proxy) {
    throw new Error(`No proxy registered for ${routePath}`);
  }

  const [pathname, search = ''] = url.split('?');
  return resolveProxyTarget(proxy, pathname, search);
}

/** A rule identifier as it appears in a Grafana URL: prefix, source *name*, namespace, group, rule, hash. */
const coreRuleId = (sourceName = MIMIR_NAME, prefix = 'cri') =>
  encodeURIComponent(`${prefix}$${sourceName}$namespace$group$rule$abc123`);

/** The same identifier as the plugin wants it, with the data source *UID* in place of the name. */
const pluginRuleId = (prefix = 'cri') => encodeURIComponent(`${prefix}$${MIMIR_UID}$namespace$group$rule$abc123`);

describe('rule pages', () => {
  describe('/alerting/:sourceName/:id/view -> /rules/:identifier', () => {
    const path = '/alerting/:sourceName/:id/view';

    it('swaps the data source name in the identifier for its UID', async () => {
      expect(await resolve(path, `/alerting/${MIMIR_NAME}/${coreRuleId()}/view`)).toBe(
        `${PLUGIN_BASE}/rules/${pluginRuleId()}`
      );
    });

    it('translates prometheus-only identifiers too', async () => {
      expect(await resolve(path, `/alerting/${MIMIR_NAME}/${coreRuleId(MIMIR_NAME, 'pri')}/view`)).toBe(
        `${PLUGIN_BASE}/rules/${pluginRuleId('pri')}`
      );
    });

    it('leaves Grafana-managed rules alone', async () => {
      expect(await resolve(path, '/alerting/grafana/some-rule-uid/view')).toBeUndefined();
    });

    it('stays on Grafana when the data source name cannot be resolved', async () => {
      expect(await resolve(path, `/alerting/Unknown/${coreRuleId('Unknown')}/view`)).toBeUndefined();
    });

    it('keeps the query string', async () => {
      expect(await resolve(path, `/alerting/${MIMIR_NAME}/${coreRuleId()}/view?tab=instances`)).toBe(
        `${PLUGIN_BASE}/rules/${pluginRuleId()}?tab=instances`
      );
    });
  });

  describe('/alerting/:id/edit -> /rules/:identifier/edit', () => {
    const path = '/alerting/:id/edit';

    it('translates the identifier', async () => {
      expect(await resolve(path, `/alerting/${coreRuleId()}/edit`)).toBe(`${PLUGIN_BASE}/rules/${pluginRuleId()}/edit`);
    });

    it('leaves a bare UID alone, because that is a Grafana-managed rule', async () => {
      expect(await resolve(path, '/alerting/some-rule-uid/edit')).toBeUndefined();
    });
  });

  describe('/alerting/:sourceName/:name/find -> /rules?search=…', () => {
    const path = '/alerting/:sourceName/:name/find';

    it('searches the rule list by data source and rule name', async () => {
      expect(await resolve(path, `/alerting/${encodeURIComponent(MIMIR_NAME)}/my%20rule/find`)).toBe(
        `${PLUGIN_BASE}/rules?${new URLSearchParams({ search: `datasource:"${MIMIR_NAME}" rule:"my rule"` })}`
      );
    });

    it('carries the namespace and group through as search terms', async () => {
      expect(await resolve(path, `/alerting/${MIMIR_NAME}/my%20rule/find?namespace=ns&group=g`)).toBe(
        `${PLUGIN_BASE}/rules?${new URLSearchParams({
          search: `datasource:"${MIMIR_NAME}" rule:"my rule" namespace:"ns" group:"g"`,
        })}`
      );
    });

    it('leaves Grafana share links alone', async () => {
      expect(await resolve(path, '/alerting/grafana/my%20rule/find')).toBeUndefined();
    });
  });

  describe('/alerting/new/:type? -> /rules/new', () => {
    const path = '/alerting/new/:type?';

    it('sends the recording rule form to the plugin with the type as a query param', async () => {
      expect(await resolve(path, '/alerting/new/recording')).toBe(`${PLUGIN_BASE}/rules/new?type=recording`);
    });

    it('redirects a clone of a data source managed rule and translates the identifier', async () => {
      const target = await resolve(path, `/alerting/new?copyFrom=${coreRuleId()}`);
      const copyFrom = new URLSearchParams(target?.split('?')[1]).get('copyFrom');

      expect(copyFrom).toBe(decodeURIComponent(pluginRuleId()));
    });

    it.each(['/alerting/new', '/alerting/new/alerting', '/alerting/new/grafana-recording'])(
      'leaves %s alone',
      async (url) => {
        expect(await resolve(path, url)).toBeUndefined();
      }
    );

    it('leaves a clone of a Grafana-managed rule alone', async () => {
      expect(await resolve(path, '/alerting/new?copyFrom=some-rule-uid')).toBeUndefined();
    });
  });

  describe.each(['view', 'edit'] as const)('group %s', (action) => {
    const path = `/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/${action}`;
    const suffix = action === 'edit' ? '/edit' : '';

    it('maps straight across, because both sides use the data source UID', async () => {
      expect(await resolve(path, `/alerting/${MIMIR_UID}/namespaces/ns/groups/my-group/${action}`)).toBe(
        `${PLUGIN_BASE}/groups/${MIMIR_UID}/ns/my-group${suffix}`
      );
    });

    it('leaves Grafana groups alone', async () => {
      expect(await resolve(path, `/alerting/grafana/namespaces/folder-uid/groups/my-group/${action}`)).toBeUndefined();
    });
  });
});

describe('alertmanager pages', () => {
  const am = `?alertmanager=${encodeURIComponent(ALERTMANAGER_NAME)}`;
  const uidParam = `alertmanager=${ALERTMANAGER_UID}`;

  it.each([
    ['/alerting/groups/', 'alerts'],
    ['/alerting/notifications', 'receivers'],
    ['/alerting/notifications/templates', 'templates'],
    ['/alerting/routes', 'routes'],
    ['/alerting/routes/mute-timing', 'time-intervals'],
    ['/alerting/routes/mute-timing/new', 'time-intervals/new'],
    ['/alerting/silences', 'silences'],
    ['/alerting/silence/new', 'silences/new'],
  ])('%s maps to the plugin page and translates the alertmanager to a UID', async (routePath, pluginPath) => {
    expect(await resolve(routePath, `${routePath}${am}`)).toBe(`${PLUGIN_BASE}/${pluginPath}?${uidParam}`);
  });

  it.each([
    ['no alertmanager param', '/alerting/notifications'],
    ['the built-in alertmanager', '/alerting/notifications?alertmanager=grafana'],
    ['an unresolvable alertmanager name', '/alerting/notifications?alertmanager=Nope'],
  ])('leaves the page alone with %s', async (_label, url) => {
    expect(await resolve('/alerting/notifications', url)).toBeUndefined();
  });

  it('sends the templates tab to the templates page', async () => {
    expect(await resolve('/alerting/notifications', `/alerting/notifications${am}&tab=templates`)).toBe(
      `${PLUGIN_BASE}/templates?${uidParam}`
    );
  });

  it('keeps other query params', async () => {
    expect(await resolve('/alerting/silences', `/alerting/silences${am}&queryString=foo`)).toBe(
      `${PLUGIN_BASE}/silences?${uidParam}&queryString=foo`
    );
  });

  it('maps a contact point to the plugin receiver page', async () => {
    expect(
      await resolve('/alerting/notifications/receivers/:name/edit', `/alerting/notifications/receivers/slack/edit${am}`)
    ).toBe(`${PLUGIN_BASE}/receivers/slack?${uidParam}`);
  });

  it('moves the time interval name from a query param into the path', async () => {
    expect(
      await resolve('/alerting/routes/mute-timing/edit', `/alerting/routes/mute-timing/edit${am}&muteName=weekends`)
    ).toBe(`${PLUGIN_BASE}/time-intervals/weekends?${uidParam}`);
  });

  it('translates repeated matcher params into the JSON the plugin expects', async () => {
    const target = await resolve(
      '/alerting/silence/new',
      `/alerting/silence/new${am}&matcher=alertname%3DHighCPU&matcher=env%21%3Dprod`
    );
    const matchers = new URLSearchParams(target?.split('?')[1]).get('matchers');

    expect(JSON.parse(matchers ?? '')).toEqual([
      { name: 'alertname', value: 'HighCPU', isRegex: false, isEqual: true },
      { name: 'env', value: 'prod', isRegex: false, isEqual: false },
    ]);
  });
});

describe('pages the plugin has no URL for', () => {
  const am = `?alertmanager=${encodeURIComponent(ALERTMANAGER_NAME)}`;
  const uidParam = `alertmanager=${ALERTMANAGER_UID}`;

  it('points a single silence at the list with the silence named', async () => {
    expect(await resolve('/alerting/silence/:id/view', `/alerting/silence/abc123/view${am}`)).toBe(
      `${PLUGIN_BASE}/silences?${uidParam}&silenceId=abc123`
    );
  });

  it('marks a silence edit so the plugin can open the form', async () => {
    expect(await resolve('/alerting/silence/:id/edit', `/alerting/silence/abc123/edit${am}`)).toBe(
      `${PLUGIN_BASE}/silences?${uidParam}&silenceId=abc123&edit=true`
    );
  });

  it('points a policy edit at the routes list with the route named', async () => {
    expect(await resolve('/alerting/routes/policy/:name/edit', `/alerting/routes/policy/my-policy/edit${am}`)).toBe(
      `${PLUGIN_BASE}/routes?${uidParam}&routeId=my-policy`
    );
  });

  it('points global config at the receivers page', async () => {
    expect(await resolve('/alerting/notifications/global-config', `/alerting/notifications/global-config${am}`)).toBe(
      `${PLUGIN_BASE}/receivers?${uidParam}&globalConfig=true`
    );
  });

  it('flags a new contact point', async () => {
    expect(await resolve('/alerting/notifications/receivers/new', `/alerting/notifications/receivers/new${am}`)).toBe(
      `${PLUGIN_BASE}/receivers?${uidParam}&create=true`
    );
  });

  it.each([
    ['new', `${uidParam}&create=true`],
    ['my-template/edit', `${uidParam}&templateName=my-template`],
    ['my-template/duplicate', `${uidParam}&templateName=my-template&create=true`],
  ])('maps the %s template route onto the templates page', async (remainder, expectedParams) => {
    expect(
      await resolve('/alerting/notifications/templates/*', `/alerting/notifications/templates/${remainder}${am}`)
    ).toBe(`${PLUGIN_BASE}/templates?${expectedParams}`);
  });
});

describe('routes we deliberately do not proxy', () => {
  it.each([
    '/alerting/list',
    '/alerting/admin/alertmanager',
    '/alerting/:id/modify-export',
    '/alerting/export-new-rule',
    '/alerting/import-to-gma',
    '/alerting/import-datasource-managed-rules',
    '/alerting',
    '/alerting/home',
    '/alerting/history/',
  ])('has no proxy for %s', (path) => {
    expect(routeProxies.find((proxy) => proxy.path === path)).toBeUndefined();
  });
});
