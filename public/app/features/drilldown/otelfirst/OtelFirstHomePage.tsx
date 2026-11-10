import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  type BadgeColor,
  Button,
  LinkButton,
  Icon,
  LoadingPlaceholder,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { getFallbackNavModel } from '../realdata/RealDrilldownPage';

import { ServiceScope } from './ServiceScope';
import { type AppId, getAppUrls, scopedAppUrl } from './appUrls';
import { type HomeData, type HomeService, loadHome } from './loadHome';

// The lab has no Pyroscope data source.
const PROFILE_SOURCES = 0;

type State = { kind: 'loading' } | { kind: 'ready'; data: HomeData } | { kind: 'error'; message: string };

// The OTel-first homepage: it starts from the service and its resource attributes, and shows which signals
// each service reports before any signal is opened.
export function OtelFirstHomePage() {
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [selected, setSelected] = useState<HomeService>();
  const [showMapping, setShowMapping] = useState(false);
  const hasNav = useNavModel('drilldown').node.id !== 'not-found';

  useEffect(() => {
    let cancelled = false;
    loadHome()
      .then((data) => !cancelled && setState({ kind: 'ready', data }))
      .catch((error: Error) => !cancelled && setState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page navId={hasNav ? 'drilldown' : undefined} navModel={hasNav ? undefined : getFallbackNavModel()}>
      <Page.Contents>
        {state.kind === 'loading' && (
          <LoadingPlaceholder text={t('drilldown-otel.loading', 'Querying the OTel lab data sources')} />
        )}
        {state.kind === 'error' && (
          <Alert severity="error" title={t('drilldown-otel.error', 'Could not query the OTel lab data sources')}>
            {state.message}
          </Alert>
        )}
        {state.kind === 'ready' && selected && (
          <ServiceScope service={selected} openMapping={showMapping} onBack={() => setSelected(undefined)} />
        )}
        {state.kind === 'ready' && !selected && (
          <div className={styles.page}>
            <Text color="secondary">
              {t('drilldown-otel.intro', 'Start from a service. Every signal opens with the same scope.')}
            </Text>
            <Coverage data={state.data} />
            <Changes
              services={state.data.services}
              onOpen={(service) => {
                setShowMapping(false);
                setSelected(service);
              }}
              onMapping={(service) => {
                setShowMapping(true);
                setSelected(service);
              }}
            />
            <ServiceTable
              services={state.data.services}
              onOpen={(service) => {
                setShowMapping(false);
                setSelected(service);
              }}
              onMapping={(service) => {
                setShowMapping(true);
                setSelected(service);
              }}
            />
          </div>
        )}
      </Page.Contents>
    </Page>
  );
}

function Coverage({ data }: { data: HomeData }) {
  const appUrls = getAppUrls(useNavModel('drilldown').node.children ?? []);
  const styles = useStyles2(getStyles);
  const { coverage } = data;
  const tiles: Array<{ key: AppId; name: string; count: number; detail: string; gap: number; gapText: string }> = [
    {
      key: 'traces',
      name: t('drilldown-otel.coverage.traces', 'Traces'),
      count: coverage.traces,
      detail: t('drilldown-otel.coverage.traces-detail', 'services with spans'),
      gap: coverage.total - coverage.traces,
      gapText: t('drilldown-otel.coverage.no-spans', '{{services}} with no spans', {
        services: coverage.total - coverage.traces,
      }),
    },
    {
      key: 'metrics',
      name: t('drilldown-otel.coverage.metrics', 'Metrics'),
      count: coverage.metrics,
      detail: t('drilldown-otel.coverage.metrics-detail', 'services with span metrics'),
      gap: coverage.total - coverage.metrics + coverage.withoutNamespace,
      gapText:
        coverage.withoutNamespace > 0
          ? t('drilldown-otel.coverage.no-namespace', '{{services}} without service.namespace', {
              services: coverage.withoutNamespace,
            })
          : t('drilldown-otel.coverage.no-metrics', '{{services}} with no span metrics', {
              services: coverage.total - coverage.metrics,
            }),
    },
    {
      key: 'logs',
      name: t('drilldown-otel.coverage.logs', 'Logs'),
      count: coverage.logs,
      detail: t('drilldown-otel.coverage.logs-detail', 'services with logs'),
      gap: coverage.total - coverage.logs,
      gapText: t('drilldown-otel.coverage.no-logs', '{{services}} with no logs', {
        services: coverage.total - coverage.logs,
      }),
    },
  ];

  return (
    <section className={styles.coverage} aria-label={t('drilldown-otel.coverage.title', 'Signal coverage')}>
      {tiles.map((tile) => (
        <div key={tile.key} className={styles.tile}>
          <Stack justifyContent="space-between" alignItems="center" width="100%">
            <Text weight="medium">{tile.name}</Text>
            {appUrls[tile.key] && (
              <LinkButton href={appUrls[tile.key]} size="sm" variant="secondary" fill="text" icon="external-link-alt">
                {t('drilldown-otel.coverage.open', 'Open')}
              </LinkButton>
            )}
          </Stack>
          <Text variant="h3">
            {tile.count} / {coverage.total}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {tile.detail}
          </Text>
          <Stack gap={0.5} alignItems="center">
            <Icon
              name={tile.gap === 0 ? 'check-circle' : 'exclamation-circle'}
              className={tile.gap === 0 ? styles.ok : styles.warn}
            />
            <Text variant="bodySmall" color={tile.gap === 0 ? 'secondary' : 'warning'}>
              {tile.gap === 0 ? t('drilldown-otel.coverage.complete', 'All services report') : tile.gapText}
            </Text>
          </Stack>
        </div>
      ))}
      <div className={styles.tile}>
        <Text weight="medium">{t('drilldown-otel.coverage.profiles', 'Profiles')}</Text>
        <Text variant="h3">{PROFILE_SOURCES}</Text>
        <Text variant="bodySmall" color="secondary">
          {t('drilldown-otel.coverage.profiles-detail', 'sources')}
        </Text>
        <Stack gap={0.5} alignItems="center">
          <Icon name="exclamation-circle" className={styles.warn} />
          <Text variant="bodySmall" color="warning">
            {t('drilldown-otel.coverage.no-pyroscope', 'No Pyroscope data source')}
          </Text>
        </Stack>
      </div>
    </section>
  );
}

const changeBadge: Record<HomeService['health'], { color: BadgeColor; text: () => string }> = {
  errors: { color: 'red', text: () => t('drilldown-otel.changes.errors', 'Errors') },
  slow: { color: 'orange', text: () => t('drilldown-otel.changes.slow', 'Slow') },
  healthy: { color: 'blue', text: () => t('drilldown-otel.changes.deploy', 'Deploy') },
};

function Changes({
  services,
  onOpen,
  onMapping,
}: {
  services: HomeService[];
  onOpen: (service: HomeService) => void;
  onMapping: (service: HomeService) => void;
}) {
  const styles = useStyles2(getStyles);
  const changed = services.filter((service) => service.health !== 'healthy' || service.newVersion);

  return (
    <section className={styles.section}>
      <Stack direction="column" gap={0.25}>
        <Text element="h2" variant="h3">
          {t('drilldown-otel.changes.title', 'Changed in the last 30 minutes')}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {t('drilldown-otel.changes.subtitle', 'From span metrics, grouped by service')}
        </Text>
      </Stack>
      {changed.length === 0 && (
        <div className={styles.row}>
          <Text color="secondary">
            {t('drilldown-otel.changes.quiet', 'All quiet: no regressions in the last 30 minutes.')}
          </Text>
        </div>
      )}
      {changed.map((service) => (
        <div key={service.name} className={styles.row}>
          <Badge color={changeBadge[service.health].color} text={changeBadge[service.health].text()} />
          <Text weight="medium">{service.name}</Text>
          <Text color="secondary">{service.change}</Text>
          <div className={styles.rowAction}>
            <Button size="sm" variant="secondary" icon="info-circle" onClick={() => onMapping(service)}>
              {t('drilldown-otel.changes.mapping', 'Attribute mapping')}
            </Button>
            <Button size="sm" variant="primary" onClick={() => onOpen(service)}>
              {t('drilldown-otel.changes.investigate', 'Investigate')}
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}

function SignalPill({
  name,
  ok,
  note,
  href,
  onClick,
}: {
  name: string;
  ok: boolean;
  note?: string;
  href?: string;
  onClick?: () => void;
}) {
  const styles = useStyles2(getStyles);
  const label = `${name}${note ? `: ${note}` : ''}`;
  if (href) {
    return (
      <a className={`${ok ? styles.pillOk : styles.pillGap} ${styles.pillLink}`} href={href}>
        {label}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={`${styles.pillGap} ${styles.pillLink}`} onClick={onClick}>
        {label}
      </button>
    );
  }
  return <span className={ok ? styles.pillOk : styles.pillGap}>{label}</span>;
}

function ServiceTable({
  services,
  onOpen,
  onMapping,
}: {
  services: HomeService[];
  onOpen: (service: HomeService) => void;
  onMapping: (service: HomeService) => void;
}) {
  const styles = useStyles2(getStyles);
  const appUrls = getAppUrls(useNavModel('drilldown').node.children ?? []);
  const linkTo = (app: AppId, service: HomeService, available: boolean) => {
    const base = appUrls[app];
    return available && base ? scopedAppUrl(app, base, service.name) : undefined;
  };
  const healthLabels: Record<HomeService['health'], string> = {
    errors: t('drilldown-otel.table.degraded', 'Errors'),
    slow: t('drilldown-otel.table.slow', 'Slow'),
    healthy: t('drilldown-otel.table.healthy', 'Healthy'),
  };
  const healthColors: Record<HomeService['health'], BadgeColor> = { errors: 'red', slow: 'orange', healthy: 'green' };

  return (
    <section className={styles.section}>
      <Stack direction="column" gap={0.25}>
        <Text element="h2" variant="h3">
          {t('drilldown-otel.table.title', 'Services')}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {t('drilldown-otel.table.subtitle', 'Ranked by change, then by name')}
        </Text>
      </Stack>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('drilldown-otel.table.service', 'Service')}</th>
              <th>{t('drilldown-otel.table.version', 'Version')}</th>
              <th>{t('drilldown-otel.table.health', 'Health')}</th>
              <th>{t('drilldown-otel.table.signals', 'Signals and attribute state')}</th>
              <th>{t('drilldown-otel.table.change', 'Last change')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.name}>
                <td>
                  <div className={styles.namespace}>
                    {service.namespace || t('drilldown-otel.table.no-namespace', 'service.namespace not set')}
                  </div>
                  <Button variant="primary" fill="text" size="sm" onClick={() => onOpen(service)}>
                    {service.name}
                  </Button>
                </td>
                <td>{service.version || t('drilldown-otel.table.unknown', 'unknown')}</td>
                <td>
                  <Stack direction="column" gap={0.25} alignItems="flex-start">
                    <Badge color={healthColors[service.health]} text={healthLabels[service.health]} />
                    <Text variant="bodySmall" color="secondary">
                      {service.health === 'errors' ? `${service.errorRate} err` : `p95 ${service.p95}`}
                    </Text>
                  </Stack>
                </td>
                <td>
                  <div className={styles.pills}>
                    <SignalPill
                      name={t('drilldown-otel.signals.traces', 'Traces')}
                      ok={service.hasTraces}
                      href={linkTo('traces', service, service.hasTraces)}
                      onClick={service.hasTraces ? undefined : () => onMapping(service)}
                    />
                    <SignalPill
                      name={t('drilldown-otel.signals.metrics', 'Metrics')}
                      ok={service.hasMetrics && !service.metricsWithoutNamespace}
                      href={linkTo('metrics', service, service.hasMetrics)}
                      onClick={service.hasMetrics ? undefined : () => onMapping(service)}
                      note={
                        !service.hasMetrics
                          ? t('drilldown-otel.signals.none', 'none')
                          : service.metricsWithoutNamespace
                            ? t('drilldown-otel.signals.no-namespace', 'no namespace')
                            : undefined
                      }
                    />
                    <SignalPill
                      name={t('drilldown-otel.signals.logs', 'Logs')}
                      ok={service.hasLogs}
                      href={linkTo('logs', service, service.hasLogs)}
                      onClick={service.hasLogs ? undefined : () => onMapping(service)}
                      note={service.hasLogs ? undefined : t('drilldown-otel.signals.none', 'none')}
                    />
                    <SignalPill
                      name={t('drilldown-otel.signals.profiles', 'Profiles')}
                      ok={false}
                      note={t('drilldown-otel.signals.none', 'none')}
                    />
                  </div>
                </td>
                <td>{service.change}</td>
                <td>
                  <Stack gap={1}>
                    <Button size="sm" variant="secondary" icon="info-circle" onClick={() => onMapping(service)}>
                      {t('drilldown-otel.table.mapping', 'Attribute mapping')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onOpen(service)}>
                      {t('drilldown-otel.table.investigate', 'Investigate')}
                    </Button>
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const pill = {
    padding: theme.spacing(0, 1),
    borderRadius: theme.shape.radius.pill,
    fontSize: theme.typography.bodySmall.fontSize,
    border: `1px solid ${theme.colors.border.weak}`,
    whiteSpace: 'nowrap' as const,
  };
  return {
    page: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(3) }),
    section: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1.5) }),
    coverage: css({
      display: 'grid',
      gap: theme.spacing(2),
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    }),
    tile: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1.5, 2),
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      padding: theme.spacing(1, 2),
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    tableWrap: css({
      overflowX: 'auto',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    table: css({
      width: '100%',
      borderCollapse: 'collapse',
      'th, td': {
        padding: theme.spacing(1, 2),
        textAlign: 'left',
        verticalAlign: 'top',
        borderBottom: `1px solid ${theme.colors.border.weak}`,
      },
      th: { color: theme.colors.text.secondary, fontWeight: theme.typography.fontWeightMedium },
      'tbody tr:last-child td': { borderBottom: 'none' },
    }),
    namespace: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
    pills: css({ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(0.5) }),
    pillOk: css({ ...pill, color: theme.colors.success.text }),
    pillGap: css({ ...pill, color: theme.colors.warning.text }),
    pillLink: css({
      cursor: 'pointer',
      '&:hover': { textDecoration: 'underline', borderColor: theme.colors.border.strong },
    }),
    rowAction: css({ marginLeft: 'auto', display: 'flex', gap: theme.spacing(1) }),
    ok: css({ color: theme.colors.success.text }),
    warn: css({ color: theme.colors.warning.text }),
  };
};

export default OtelFirstHomePage;
