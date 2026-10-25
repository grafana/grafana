import { css } from '@emotion/css';
import { Global } from '@emotion/react';
import { type ReactNode, useMemo, useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { createTheme, dateTimeFormat, dateTimeFormatTimeAgo, type GrafanaTheme2, ThemeContext } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Alert,
  Badge,
  type BadgeColor,
  Button,
  Icon,
  Input,
  Select,
  Stack,
  Text,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

export const routerStatusURL = 'apis/discovery/v1alpha2/status';

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

interface GroupStatus {
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

const healthColors: Record<string, BadgeColor> = {
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
  const theme = createTheme({ colors: { mode: 'light' } });
  const status = useAsyncRetry(async () => {
    const rsp = await fetch(routerStatusURL, { cache: 'no-store' });
    if (!rsp.ok) {
      throw new Error(`HTTP ${rsp.status} ${rsp.statusText}`);
    }
    const doc: RouterStatus = await rsp.json();
    return doc;
  });

  return (
    <ThemeContext.Provider value={theme}>
      <Global
        styles={{
          html: {
            fontSize: `${theme.typography.htmlFontSize}px`,
          },
          body: {
            margin: 0,
            ...theme.typography.body,
          },
        }}
      />
      <div style={{ backgroundColor: '#000', padding: '10px' }}>
        <Stack alignItems="center" justifyContent="space-between">
          <Icon name="grafana" size="xxl" />
          <Button icon="sync" variant="secondary" onClick={status.retry} disabled={status.loading}>
            <Trans i18nKey="swagger.router-status.refresh">Refresh</Trans>
          </Button>
        </Stack>
      </div>
      <div style={{ padding: theme.spacing(2) }}>
        {status.error && (
          <Alert title={t('swagger.router-status.error-title', 'Unable to load router status')} severity="error">
            {status.error.message}
          </Alert>
        )}
        {status.value && <RouterStatusView status={status.value} />}
        {!status.value && status.loading && <div>...</div>}
      </div>
    </ThemeContext.Provider>
  );
};

const RouterStatusView = ({ status }: { status: RouterStatus }) => {
  const { reconciler, breakers } = status;
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<string>();

  const sources = useMemo(
    () => [...new Set(status.groups.map((g) => g.source))].sort().map((s) => ({ label: s, value: s })),
    [status.groups]
  );
  const health = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of status.groups) {
      counts[g.health] = (counts[g.health] ?? 0) + 1;
    }
    return Object.entries(counts).sort(([a], [b]) => healthOrder(a) - healthOrder(b));
  }, [status.groups]);
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

      {Boolean(status.sources?.length) && (
        <Section title={t('swagger.router-status.sources', 'Sources')}>
          <Table
            headers={['Source', 'Last success', 'Successes', 'Failures', 'Skipped']}
            rows={status.sources!.map((s) => [
              <SourceBadge key="source" source={s.source} />,
              <TimeAgo key="last" value={s.lastSuccess} />,
              s.successes,
              <Count key="failures" value={s.failures} color="error" />,
              <Count key="skipped" value={s.skipped} color="warning" />,
            ])}
          />
        </Section>
      )}

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
          />
        </Section>
      )}

      <Section title={t('swagger.router-status.groups', 'Groups')}>
        <Stack gap={1} alignItems="center" wrap="wrap">
          {health.map(([h, n]) => (
            <Badge key={h} color={healthColors[h] ?? 'darkgrey'} text={`${n} ${h}`} />
          ))}
        </Stack>
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
              onChange={(v) => setSource(v?.value)}
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
            'Requests',
            'Failures',
            'Plugin',
            'Loaded',
            'Discovery',
            'OpenAPI cached',
            'Watches',
          ]}
          rows={groups.map((g) => [
            g.group,
            <Badge key="health" color={healthColors[g.health] ?? 'darkgrey'} text={g.health} />,
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
            g.discovery,
            g.openapiCached?.join(', ') || '-',
            g.watches,
          ])}
        />
      </Section>

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
          />
        </Section>
      )}

      {status.stackLookups && Object.keys(status.stackLookups).length > 0 && (
        <Section title={t('swagger.router-status.stack-lookups', 'Stack lookups')}>
          <StackLookups lookups={status.stackLookups} />
        </Section>
      )}
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
    case 'core_url':
      return 'green';
    case 'plugins_url':
      return 'orange';
  }
  return 'darkgrey';
}

const SourceBadge = ({ source }: { source: string }) => <Badge color={sourceColor(source)} text={source} />;

const isZeroTime = (value?: string) => !value || value.startsWith('0001-');

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

const BreakerCell = ({ breaker }: { breaker: GroupStatus['breaker'] }) => {
  if (!breaker.state) {
    return (
      <Tooltip
        content={t('swagger.router-status.per-destination', 'The single-tenant fallback keeps a breaker per stack')}
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

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Stack direction="column" gap={1}>
    <Text element="h3">{title}</Text>
    {children}
  </Stack>
);

const Table = ({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  stat: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1, 2),
    minWidth: theme.spacing(12),
  }),
  wrapper: css({
    overflowX: 'auto',
  }),
  table: css({
    borderCollapse: 'collapse',
    width: '100%',
    'th, td': {
      textAlign: 'left',
      padding: theme.spacing(0.5, 1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      verticalAlign: 'top',
      whiteSpace: 'nowrap',
    },
    th: {
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    },
  }),
});
