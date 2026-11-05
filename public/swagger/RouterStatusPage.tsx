import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { dateTimeFormat, dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Alert,
  Badge,
  type BadgeColor,
  Box,
  Button,
  Icon,
  Input,
  Select,
  Stack,
  Tab,
  TabContent,
  TabsBar,
  Text,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

import { devFixture, RouterShell, Section, Table } from './RouterShell';

export const routerStatusURL = 'apis/discovery/v1alpha2/status';

/** The status page's groups, filtered to those a source serves. */
export const groupsBySourceHref = (source: string) =>
  `swagger?${new URLSearchParams({ router: 'status', tab: 'groups', source })}`;

// Mirrors routerStatusDoc in pkg/router/discovery_status.go
export interface RouterStatus {
  ready: boolean;
  reconciler: {
    phase: string;
    last?: string;
    lastFailed: boolean;
    total: number;
    errors: number;
  };
  breakers: {
    openAfterConsecutiveFailures: number;
    openFor: string;
  };
  groups: GroupStatus[];
  loadFailures?: LoadFailure[];
  sources?: SourceStatus[];
  shadowed?: Array<{ group: string; source: string; servedBy: string }>;
  stackLookups?: Record<string, number>;
}

export interface GroupStatus {
  group: string;
  source: string;
  key: string;
  health: string;
  breaker: {
    scope: string;
    state?: string;
    requests: number;
    successes: number;
    failures: number;
    consecutiveFailures: number;
    failuresUntilOpen?: number;
    retryAt?: string;
  };
  plugin?: { id: string; version?: string; hasBackend: boolean };
  loadedAt: string;
  manifest: boolean;
  // internal for a group only access policies see, public otherwise
  visibility: string;
  discovery: string;
  openapiCached?: string[];
  watches: number;
}

interface LoadFailure {
  group: string;
  key: string;
  failures: number;
  since: string;
  retryAt: string;
  serving: boolean;
}

interface SourceStatus {
  source: string;
  lastSuccess: string;
  successes: number;
  failures: number;
  skipped: number;
}

export const healthColors: Record<string, BadgeColor> = {
  ok: 'green',
  degraded: 'orange',
  recovering: 'blue',
  unavailable: 'red',
};

const phaseColors: Record<string, BadgeColor> = {
  serving: 'green',
  starting: 'blue',
  stopped: 'orange',
  crashed: 'red',
};

// Go marshals a zero time.Time as 0001-01-01T00:00:00Z
function formatTime(value?: string) {
  if (!value || value.startsWith('0001-')) {
    return '-';
  }
  return dateTimeFormat(value);
}

export const RouterStatusPage = () => {
  const status = useAsyncRetry(async () => {
    const fixture = devFixture<RouterStatus>('routerStatusFixture');
    if (fixture) {
      return fixture;
    }
    const rsp = await fetch(routerStatusURL, { cache: 'no-store' });
    if (!rsp.ok) {
      throw new Error(`HTTP ${rsp.status} ${rsp.statusText}`);
    }
    const doc: RouterStatus = await rsp.json();
    return doc;
  });

  return (
    <RouterShell
      page="status"
      actions={
        <Button icon="sync" variant="secondary" onClick={status.retry} disabled={status.loading}>
          <Trans i18nKey="swagger.router-status.refresh">Refresh</Trans>
        </Button>
      }
    >
      {status.error && (
        <Alert title={t('swagger.router-status.error-title', 'Unable to load router status')} severity="error">
          {status.error.message}
        </Alert>
      )}
      {status.value && <RouterStatusView status={status.value} />}
      {!status.value && status.loading && <div>...</div>}
    </RouterShell>
  );
};

type StatusTab = 'groups' | 'sources' | 'lookups';

// The tab and the group source filter live in the URL so a view can be bookmarked or shared
function readTab(): StatusTab {
  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab === 'sources' || tab === 'lookups' ? tab : 'groups';
}

function readSource(): string | undefined {
  return new URLSearchParams(window.location.search).get('source') || undefined;
}

function writeView(tab: StatusTab, source?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  if (source) {
    url.searchParams.set('source', source);
  } else {
    url.searchParams.delete('source');
  }
  // Each change of view is a history entry, so Back returns to the previous one
  if (url.href !== window.location.href) {
    window.history.pushState(null, '', url);
  }
}

function viewHref(tab: StatusTab, source?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  if (source) {
    url.searchParams.set('source', source);
  } else {
    url.searchParams.delete('source');
  }
  return `${url.pathname}${url.search}`;
}

// Plain clicks change the view in place; a modified click is left to the browser, to open the link elsewhere
function onPlainClick(e: React.MouseEvent, navigate: () => void) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    // The row holding the link would otherwise navigate this window too
    e.stopPropagation();
    return;
  }
  e.preventDefault();
  navigate();
}

const RouterStatusView = ({ status }: { status: RouterStatus }) => {
  const { reconciler, breakers } = status;
  const [query, setQuery] = useState('');
  const [source, setSource] = useState(readSource);
  const [requestedTab, setTab] = useState(readTab);
  const showView = (nextTab: StatusTab, nextSource: string | undefined) => {
    setTab(nextTab);
    setSource(nextSource);
    writeView(nextTab, nextSource);
  };
  const switchTab = (next: StatusTab) => showView(next, source);
  useEffect(() => {
    const onPopState = () => {
      setTab(readTab());
      setSource(readSource());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of status.groups) {
      counts.set(g.source, (counts.get(g.source) ?? 0) + 1);
    }
    return counts;
  }, [status.groups]);
  const hasLookups = Boolean(status.stackLookups && Object.keys(status.stackLookups).length > 0);
  const tab = requestedTab === 'lookups' && !hasLookups ? 'groups' : requestedTab;

  const sources = useMemo(
    () => [...new Set(status.groups.map((g) => g.source))].sort().map((s) => ({ label: s, value: s })),
    [status.groups]
  );
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return status.groups.filter(
      (g) =>
        (!source || g.source === source) &&
        (!q || [g.group, g.key, g.plugin?.id ?? ''].some((v) => v.toLowerCase().includes(q)))
    );
  }, [status.groups, query, source]);

  return (
    <Stack direction="column" gap={3}>
      <Stack direction="column" gap={1}>
        <Text element="h2">
          <Trans i18nKey="swagger.router-status.title">Router status</Trans>
        </Text>
        <Stack gap={2} alignItems="center" wrap="wrap">
          {status.ready ? (
            <Badge color="green" text={t('swagger.router-status.ready', 'Ready')} icon="check" />
          ) : (
            <Badge color="red" text={t('swagger.router-status.not-ready', 'Not ready')} icon="exclamation-triangle" />
          )}
          <Badge color={phaseColors[reconciler.phase] ?? 'darkgrey'} text={reconciler.phase} />
          <Text color="secondary">
            <Trans
              i18nKey="swagger.router-status.reconciler"
              values={{ last: formatTime(reconciler.last), total: reconciler.total, errors: reconciler.errors }}
            >
              Last reconcile: {'{{last}}'} · {'{{total}}'} reconciles, {'{{errors}}'} errors
            </Trans>
          </Text>
          {reconciler.lastFailed && (
            <Badge color="orange" text={t('swagger.router-status.last-failed', 'Last reconcile failed')} />
          )}
          <Text color="secondary">
            <Trans
              i18nKey="swagger.router-status.breaker-settings"
              values={{ after: breakers.openAfterConsecutiveFailures, openFor: breakers.openFor }}
            >
              Breakers open after {'{{after}}'} consecutive failures, for {'{{openFor}}'}
            </Trans>
          </Text>
        </Stack>
      </Stack>

      <div>
        <TabsBar>
          <Tab
            label={t('swagger.router-status.tab-groups', 'Groups')}
            counter={status.groups.length}
            active={tab === 'groups'}
            href={viewHref('groups', source)}
            onChangeTab={(e) => onPlainClick(e, () => switchTab('groups'))}
          />
          <Tab
            label={t('swagger.router-status.tab-sources', 'Sources')}
            counter={status.sources?.length}
            active={tab === 'sources'}
            href={viewHref('sources', source)}
            onChangeTab={(e) => onPlainClick(e, () => switchTab('sources'))}
          />
          {hasLookups && (
            <Tab
              label={t('swagger.router-status.tab-lookups', 'Stack lookups')}
              active={tab === 'lookups'}
              href={viewHref('lookups', source)}
              onChangeTab={(e) => onPlainClick(e, () => switchTab('lookups'))}
            />
          )}
        </TabsBar>
        <TabContent>
          <Box paddingTop={2}>
            <Stack direction="column" gap={3}>
              {tab === 'groups' && (
                <>
                  {Boolean(status.loadFailures?.length) && (
                    <Section title={t('swagger.router-status.load-failures', 'Load failures')}>
                      <Table
                        headers={['Group', 'Key', 'Failures', 'Since', 'Retry at', 'Serving']}
                        rows={status.loadFailures!.map((f) => [
                          f.group,
                          <code key="key">{f.key}</code>,
                          <Count key="failures" value={f.failures} color="error" />,
                          <TimeAgo key="since" value={f.since} />,
                          formatTime(f.retryAt),
                          f.serving ? 'yes' : <Text color="error">no</Text>,
                        ])}
                        sortValues={status.loadFailures!.map((f) => [
                          f.group,
                          f.key,
                          f.failures,
                          timeValue(f.since),
                          timeValue(f.retryAt),
                          f.serving ? 1 : 0,
                        ])}
                      />
                    </Section>
                  )}

                  <Stack direction="column" gap={1}>
                    <Stack gap={1} alignItems="center">
                      <Input
                        prefix={<Icon name="search" />}
                        placeholder={t('swagger.router-status.filter-placeholder', 'Filter by group, key or plugin')}
                        value={query}
                        onChange={(e) => setQuery(e.currentTarget.value)}
                        width={40}
                      />
                      {sources.length > 1 && (
                        <Select
                          options={sources}
                          value={source ?? null}
                          onChange={(v) => showView(tab, v?.value)}
                          placeholder={t('swagger.router-status.all-sources', 'All sources')}
                          isClearable
                          width={30}
                        />
                      )}
                      {groups.length !== status.groups.length && (
                        <Text color="secondary">
                          <Trans
                            i18nKey="swagger.router-status.filtered"
                            values={{ shown: groups.length, total: status.groups.length }}
                          >
                            {'{{shown}}'} of {'{{total}}'}
                          </Trans>
                        </Text>
                      )}
                    </Stack>
                    <Table
                      headers={[
                        'Group',
                        'Health',
                        'Source',
                        'Breaker',
                        {
                          label: 'Requests',
                          tooltip: t(
                            'swagger.router-status.requests-description',
                            "Requests the group's breaker let through to the backend, or the plugin's client calls when its scope is plugin-calls. Counted since the backend was loaded or the breaker last changed state."
                          ),
                        },
                        {
                          label: 'Failures',
                          tooltip: t(
                            'swagger.router-status.failures-description',
                            'Of those, the ones counted against the backend: 502, 503 and 504 responses, and failures to proxy, such as connection errors and timeouts. Other errors, and callers that disconnect, are not counted. Consecutive failures open the breaker.'
                          ),
                        },
                        'Plugin',
                        'Loaded',
                        'Discovery',
                        'OpenAPI cached',
                        'Watches',
                      ]}
                      rows={groups.map((g) => [
                        <GroupCell key="group" group={g} />,
                        g.health === 'unknown' ? null : (
                          <Badge key="health" color={healthColors[g.health] ?? 'darkgrey'} text={g.health} />
                        ),
                        <Tooltip key="source" content={<code>{g.key}</code>}>
                          <span>
                            <SourceBadge source={g.source} />
                          </span>
                        </Tooltip>,
                        <BreakerCell key="breaker" breaker={g.breaker} />,
                        g.breaker.requests,
                        g.breaker.consecutiveFailures ? (
                          <Text color="error">{`${g.breaker.failures} (${g.breaker.consecutiveFailures} consecutive)`}</Text>
                        ) : (
                          g.breaker.failures
                        ),
                        <PluginCell key="plugin" plugin={g.plugin} />,
                        <TimeAgo key="loaded" value={g.loadedAt} />,
                        <DiscoveryCell key="discovery" discovery={g.discovery} />,
                        g.openapiCached?.join(', ') || '-',
                        g.watches,
                      ])}
                      defaultSort={{ column: 4, descending: true }}
                      sortValues={groups.map((g) => [
                        g.group,
                        healthOrder(g.health),
                        g.source,
                        g.breaker.state ?? g.breaker.scope,
                        g.breaker.requests,
                        g.breaker.failures,
                        g.plugin?.id,
                        timeValue(g.loadedAt),
                        g.discovery,
                        g.openapiCached?.join(', '),
                        g.watches,
                      ])}
                    />
                  </Stack>
                  {Boolean(status.shadowed?.length) && (
                    <Section title={t('swagger.router-status.shadowed', 'Shadowed groups')}>
                      <Text color="secondary">
                        <Trans i18nKey="swagger.router-status.shadowed-description">
                          Groups a source offers that a higher-priority source serves instead.
                        </Trans>
                      </Text>
                      <Table
                        headers={['Group', 'Offered by', 'Served by']}
                        rows={status.shadowed!.map((s) => [
                          s.group,
                          <SourceBadge key="source" source={s.source} />,
                          <SourceBadge key="by" source={s.servedBy} />,
                        ])}
                        sortValues={status.shadowed!.map((s) => [s.group, s.source, s.servedBy])}
                      />
                    </Section>
                  )}
                </>
              )}
              {tab === 'sources' && (
                <>
                  {Boolean(status.sources?.length) && (
                    <Table
                      headers={['Source', 'Groups', 'Last success', 'Successes', 'Failures', 'Skipped']}
                      defaultSort={{ column: 1, descending: true }}
                      onRowClick={(i) => showView('groups', status.sources![i].source)}
                      rows={status.sources!.map((s) => [
                        <a
                          key="source"
                          href={viewHref('groups', s.source)}
                          // The row handles a plain click; the link is for opening it elsewhere
                          onClick={(e) => onPlainClick(e, () => undefined)}
                        >
                          <SourceBadge source={s.source} />
                        </a>,
                        groupCounts.get(s.source) ?? 0,
                        <TimeAgo key="last" value={s.lastSuccess} />,
                        s.successes,
                        <Count key="failures" value={s.failures} color="error" />,
                        <Count key="skipped" value={s.skipped} color="warning" />,
                      ])}
                      sortValues={status.sources!.map((s) => [
                        s.source,
                        groupCounts.get(s.source) ?? 0,
                        timeValue(s.lastSuccess),
                        s.successes,
                        s.failures,
                        s.skipped,
                      ])}
                    />
                  )}
                </>
              )}
              {tab === 'lookups' && hasLookups && <StackLookups lookups={status.stackLookups!} />}
            </Stack>
          </Box>
        </TabContent>
      </div>
    </Stack>
  );
};

const healthOrder = (health: string) => {
  const i = ['unavailable', 'recovering', 'degraded', 'ok'].indexOf(health);
  return i < 0 ? 99 : i;
};

// Source names are defined in pkg/router/sources.go
function sourceColor(source: string): BadgeColor {
  if (source.startsWith('aggregate:')) {
    return 'blue';
  }
  switch (source) {
    case 'single-tenant':
      return 'purple';
    case 'core':
      return 'brand';
    case 'plugins':
      return 'green';
    case 'bridge':
      return 'orange';
  }
  return 'darkgrey';
}

export const SourceBadge = ({ source }: { source: string }) => <Badge color={sourceColor(source)} text={source} />;

const isZeroTime = (value?: string) => !value || value.startsWith('0001-');

// A time that never happened has no sort value, so it sorts last
const timeValue = (value?: string) => (isZeroTime(value) ? undefined : Date.parse(value!));

const TimeAgo = ({ value }: { value?: string }) => {
  if (isZeroTime(value)) {
    return <Text color="secondary">{t('swagger.router-status.never', 'never')}</Text>;
  }
  return (
    <Tooltip content={dateTimeFormat(value!)}>
      <span>{dateTimeFormatTimeAgo(value!)}</span>
    </Tooltip>
  );
};

const Count = ({ value, color }: { value: number; color: 'error' | 'warning' }) =>
  value > 0 ? <Text color={color}>{value}</Text> : <Text color="secondary">0</Text>;

const GroupCell = ({ group }: { group: GroupStatus }) => {
  if (group.visibility !== 'internal') {
    return <>{group.group}</>;
  }
  return (
    <Stack gap={1} alignItems="center">
      <span>{group.group}</span>
      <Tooltip
        content={t(
          'swagger.router-status.internal-description',
          'Only access policies see this group. Every other caller gets a 404 for it, and it is not listed in their discovery.'
        )}
      >
        <span>
          <Badge color="purple" text={t('swagger.router-status.internal', 'internal')} />
        </span>
      </Tooltip>
    </Stack>
  );
};

const PluginCell = ({ plugin }: { plugin?: GroupStatus['plugin'] }) => {
  if (!plugin) {
    return <Text color="secondary">-</Text>;
  }
  return (
    <Stack direction="column" gap={0}>
      <span>
        {plugin.id}
        {plugin.version && <Text color="secondary">{` @${plugin.version}`}</Text>}
      </span>
      {!plugin.hasBackend && (
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="swagger.router-status.no-backend">no backend</Trans>
        </Text>
      )}
    </Stack>
  );
};

// Results are defined by the single-tenant fallback's stack lookups in pkg/router/st_fallback.go
const lookupOrder = ['resolved', 'cache_hit', 'not_found', 'throttled', 'error'];
const lookupProblems = new Set(['throttled', 'error']);

const StackLookups = ({ lookups }: { lookups: Record<string, number> }) => {
  const styles = useStyles2(getStyles);
  const keys = Object.keys(lookups).sort((a, b) => {
    const ia = lookupOrder.indexOf(a) < 0 ? 99 : lookupOrder.indexOf(a);
    const ib = lookupOrder.indexOf(b) < 0 ? 99 : lookupOrder.indexOf(b);
    return ia - ib || (a < b ? -1 : 1);
  });
  return (
    <Stack gap={1} wrap="wrap">
      {keys.map((k) => (
        <div key={k} className={styles.stat}>
          <Text element="h4" color={lookupProblems.has(k) && lookups[k] > 0 ? 'error' : 'primary'}>
            {lookups[k]}
          </Text>
          <Text color="secondary" variant="bodySmall">
            {k.replace(/_/g, ' ')}
          </Text>
        </div>
      ))}
    </Stack>
  );
};

// discoveryDescriptions explains each value of a group's discovery source.
const discoveryDescriptions = (): Record<string, string> => ({
  provided: t(
    'swagger.router-status.discovery-provided',
    'The backend supplied its resources when it loaded, so discovery never asks it per request'
  ),
  cached: t(
    'swagger.router-status.discovery-cached',
    'Fetched from the backend; the copy is fresh for 5 minutes after the fetch'
  ),
  expired: t(
    'swagger.router-status.discovery-expired',
    'Fetched from the backend, but older than 5 minutes: the next /apis request fetches it again, and serves this copy if that fails'
  ),
  'not-cached': t(
    'swagger.router-status.discovery-not-cached',
    'Not fetched yet: the next aggregated /apis request fetches it from the backend'
  ),
});

const DiscoveryCell = ({ discovery }: { discovery: string }) => {
  const description = discoveryDescriptions()[discovery];
  if (!description) {
    return <>{discovery}</>;
  }
  return (
    <Tooltip content={description}>
      <span>{discovery}</span>
    </Tooltip>
  );
};

const BreakerCell = ({ breaker }: { breaker: GroupStatus['breaker'] }) => {
  if (!breaker.state) {
    return (
      <Tooltip
        content={
          breaker.scope === 'per-destination'
            ? t('swagger.router-status.per-destination', 'The single-tenant fallback keeps a breaker per stack')
            : t('swagger.router-status.no-breaker', 'Served in process, without a breaker')
        }
      >
        <span>
          <Text color="secondary">{breaker.scope}</Text>
        </span>
      </Tooltip>
    );
  }
  return (
    <Stack direction="column" gap={0}>
      <span>{breaker.state}</span>
      <Text color="secondary" variant="bodySmall">
        {breaker.scope}
        {breaker.retryAt && ` · retry ${formatTime(breaker.retryAt)}`}
        {breaker.failuresUntilOpen !== undefined && ` · ${breaker.failuresUntilOpen} until open`}
      </Text>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  stat: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1, 2),
    minWidth: theme.spacing(12),
  }),
});
