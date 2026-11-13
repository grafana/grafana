import { css } from '@emotion/css';
import { type ReactNode, useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Alert,
  Badge,
  type BadgeColor,
  Button,
  Combobox,
  Field,
  Icon,
  type IconName,
  LinkButton,
  LoadingPlaceholder,
  RadioButtonGroup,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { ServiceScope } from '../otelfirst/ServiceScope';
import { type AppId, getAppUrls, scopedAppUrl } from '../otelfirst/appUrls';
import { getFallbackNavModel } from '../realdata/RealDrilldownPage';
import { TrendSparkline } from '../realdata/components/TrendSparkline';

import { type Impact, NO_NAMESPACE, type WideData, type WideService, loadWide } from './loadWide';

type Level = 'home' | 'team' | 'service';

type State = { kind: 'loading' } | { kind: 'ready'; data: WideData } | { kind: 'error'; message: string };

const VERSION_ID = 'wide-narrow';

// One URL per level. Narrowing keeps the group and the service in the URL, so zooming back out lands where it started.
function goTo(level: Level, params: { group?: string; service?: string } = {}) {
  locationService.partial(
    {
      version: VERSION_ID,
      view: level === 'home' ? null : level,
      group: params.group ?? null,
      service: params.service ?? null,
    },
    false
  );
}

const groupLabel = (group: string) =>
  group === NO_NAMESPACE ? t('drilldown-wide.group.none', 'No service.namespace') : group;

const impactColor: Record<Impact, BadgeColor> = { high: 'red', low: 'orange', none: 'green' };

function useWide() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    loadWide()
      .then((data) => !cancelled && setState({ kind: 'ready', data }))
      .catch((error: Error) => !cancelled && setState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

// The page frame shared by the three levels: scope switch, scope chips, loading and error states.
function Shell({
  level,
  group,
  service,
  children,
}: {
  level: Level;
  group?: string;
  service?: string;
  children: (data: WideData) => ReactNode;
}) {
  const styles = useStyles2(getStyles);
  const state = useWide();
  const hasNav = useNavModel('drilldown').node.id !== 'not-found';
  const notReported = t('drilldown-wide.chip.not-reported', 'not reported');

  return (
    <Page navId={hasNav ? 'drilldown' : undefined} navModel={hasNav ? undefined : getFallbackNavModel()}>
      <Page.Contents>
        <div className={styles.page}>
          <Stack justifyContent="space-between" alignItems="center" wrap="wrap">
            <Stack direction="column" gap={0.5}>
              <Text element="h2" variant="h2">
                {level === 'home'
                  ? t('drilldown-wide.title.home', 'Environment')
                  : level === 'team'
                    ? group
                      ? groupLabel(group)
                      : t('drilldown-wide.title.team', 'Namespace')
                    : (service ?? t('drilldown-wide.title.service', 'Service'))}
              </Text>
              <div className={styles.chips}>
                {level !== 'service' && (
                  <span className={styles.chip}>
                    <span className={styles.chipKey}>{'deployment.environment.name ='}</span>
                    <span className={styles.muted}>{notReported}</span>
                  </span>
                )}
                {level === 'team' && group && (
                  <span className={styles.chip}>
                    <span className={styles.chipKey}>{'service.namespace ='}</span>
                    {group === NO_NAMESPACE ? notReported : group}
                  </span>
                )}
                <span className={styles.chip}>{t('drilldown-wide.chip.window', 'Last 30 minutes')}</span>
                <span className={styles.chip}>{t('drilldown-wide.chip.compare', 'vs the previous 30 minutes')}</span>
              </div>
            </Stack>
            <RadioButtonGroup<Level>
              value={level}
              options={[
                { label: t('drilldown-wide.scope.environment', 'Environment'), value: 'home' },
                { label: t('drilldown-wide.scope.team', 'Namespace'), value: 'team' },
                { label: t('drilldown-wide.scope.service', 'Service'), value: 'service' },
              ]}
              onChange={(next) => {
                if (next === 'home') {
                  goTo('home');
                } else if (state.kind === 'ready') {
                  const top = state.data.services[0];
                  const nextGroup = group ?? top?.group ?? state.data.groups[0];
                  goTo(next, {
                    group: nextGroup,
                    service: next === 'service' ? (service ?? top?.home.name) : undefined,
                  });
                }
              }}
            />
          </Stack>
          {state.kind === 'loading' && (
            <LoadingPlaceholder text={t('drilldown-wide.loading', 'Ranking services by change in the OTel lab')} />
          )}
          {state.kind === 'error' && (
            <Alert severity="error" title={t('drilldown-wide.error', 'Could not query the OTel lab data sources')}>
              {state.message}
            </Alert>
          )}
          {state.kind === 'ready' && children(state.data)}
        </div>
      </Page.Contents>
    </Page>
  );
}

function SignalIcons({ service }: { service: WideService }) {
  const styles = useStyles2(getStyles);
  const signals: Array<{ name: string; icon: IconName; changed: boolean }> = [
    { name: t('drilldown-wide.signals.metrics', 'Metrics'), icon: 'graph-bar', changed: service.metrics.changed },
    { name: t('drilldown-wide.signals.logs', 'Logs'), icon: 'list-ul', changed: service.logs.changed },
    { name: t('drilldown-wide.signals.traces', 'Traces'), icon: 'sitemap', changed: service.traces.changed },
    { name: t('drilldown-wide.signals.profiles', 'Profiles'), icon: 'fire', changed: false },
  ];
  return (
    <Stack gap={1}>
      {signals.map((signal) => (
        <span key={signal.name} title={signal.name} className={signal.changed ? styles.changedIcon : styles.mutedIcon}>
          <Icon name={signal.icon} aria-label={signal.name} />
        </span>
      ))}
    </Stack>
  );
}

function ImpactBadge({ impact }: { impact: Impact }) {
  const labels: Record<Impact, string> = {
    high: t('drilldown-wide.impact.high', 'High'),
    low: t('drilldown-wide.impact.low', 'Low'),
    none: t('drilldown-wide.impact.none', 'None'),
  };
  return <Badge color={impactColor[impact]} text={labels[impact]} />;
}

function Tile({ title, detail, tone }: { title: string; detail: string; tone?: 'warning' }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.tile}>
      <Text weight="medium" color={tone}>
        {title}
      </Text>
      <Text variant="bodySmall" color="secondary">
        {detail}
      </Text>
    </div>
  );
}

function ChangesList({ data, group }: { data: WideData; group?: string }) {
  const styles = useStyles2(getStyles);
  const changes = data.versionChanges.filter((change) => group === undefined || change.group === group);
  return (
    <aside className={styles.side}>
      <Stack direction="column" gap={0.25}>
        <Text element="h3" variant="h4">
          {group === undefined
            ? t('drilldown-wide.changes.title', 'Changes in the last 30 minutes')
            : t('drilldown-wide.changes.title-team', 'Changes in this namespace')}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {t(
            'drilldown-wide.changes.subtitle',
            'Read from service.version on span metrics. The lab sends no deploy, flag or config events.'
          )}
        </Text>
      </Stack>
      {changes.length === 0 && (
        <Text color="secondary">{t('drilldown-wide.changes.none', 'No new service.version in this window.')}</Text>
      )}
      {changes.map((change) => (
        <div key={change.service} className={styles.change}>
          <Icon name="code-branch" />
          <div>
            <Text weight="medium">
              {t('drilldown-wide.changes.version', 'Version {{version}} started', { version: change.version })}
            </Text>
            <Text variant="bodySmall" color="secondary">
              {change.service}
            </Text>
          </div>
        </div>
      ))}
    </aside>
  );
}

function RankedTable({ services, showGroup }: { services: WideService[]; showGroup: boolean }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('drilldown-wide.table.service', 'Service')}</th>
            {showGroup && <th>{t('drilldown-wide.table.namespace', 'Namespace')}</th>}
            <th>{t('drilldown-wide.table.changed', 'What changed')}</th>
            <th>{t('drilldown-wide.table.signals', 'Signals')}</th>
            <th>{t('drilldown-wide.table.trend', 'p95, last hour')}</th>
            <th>{t('drilldown-wide.table.impact', 'Impact')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.home.name}>
              <td>
                <Button
                  variant="primary"
                  fill="text"
                  size="sm"
                  onClick={() => goTo('service', { group: service.group, service: service.home.name })}
                >
                  {service.home.name}
                </Button>
                <div className={styles.small}>
                  {service.home.version
                    ? t('drilldown-wide.table.version', 'version {{version}}', { version: service.home.version })
                    : t('drilldown-wide.table.no-version', 'no service.version')}
                </div>
              </td>
              {showGroup && (
                <td>
                  <Button
                    variant="secondary"
                    fill="text"
                    size="sm"
                    onClick={() => goTo('team', { group: service.group })}
                  >
                    {groupLabel(service.group)}
                  </Button>
                </td>
              )}
              <td>{service.summary || t('drilldown-wide.table.nothing', 'No change')}</td>
              <td>
                <SignalIcons service={service} />
              </td>
              <td className={styles.trendCell}>
                {service.trend.length > 1 && (
                  <TrendSparkline values={service.trend} color={service.impact === 'high' ? 'red' : 'green'} />
                )}
              </td>
              <td>
                <ImpactBadge impact={service.impact} />
              </td>
              <td>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => goTo('service', { group: service.group, service: service.home.name })}
                >
                  {t('drilldown-wide.table.open', 'Open')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Level 1: every service in the environment, ranked by change in any signal.
export function WideEnvironmentView() {
  return <Shell level="home">{(data) => <EnvironmentBody data={data} />}</Shell>;
}

function EnvironmentBody({ data }: { data: WideData }) {
  const styles = useStyles2(getStyles);
  const [showQuiet, setShowQuiet] = useState(false);
  const changed = data.services.filter((service) => service.impact !== 'none');
  const quiet = data.services.filter((service) => service.impact === 'none');
  const logChanges = data.services.filter((service) => service.logs.changed).map((service) => service.home.name);

  return (
    <>
      <div className={styles.strip}>
        <Tile
          title={t('drilldown-wide.strip.changed', '{{changed}} services changed', { changed: changed.length })}
          detail={t('drilldown-wide.strip.versions', '{{versions}} with a new version', {
            versions: data.versionChanges.length,
          })}
          tone={changed.length > 0 ? 'warning' : undefined}
        />
        <Tile
          title={t('drilldown-wide.strip.quiet', '{{quiet}} unchanged', { quiet: quiet.length })}
          detail={t('drilldown-wide.strip.normal', 'Within the normal range for every signal')}
        />
        <Tile
          title={t('drilldown-wide.strip.logs', '{{logs}} log volume changes', { logs: logChanges.length })}
          detail={logChanges.slice(0, 3).join(', ') || t('drilldown-wide.strip.no-logs', 'None')}
        />
        <Tile
          title={t('drilldown-wide.strip.profiles', '0 CPU hotspots')}
          detail={t('drilldown-wide.strip.no-pyroscope', 'The lab has no Pyroscope data source')}
        />
      </div>
      <div className={styles.split}>
        <section className={styles.section}>
          <Stack direction="column" gap={0.25}>
            <Text element="h3" variant="h4">
              {t('drilldown-wide.ranked.title', 'Services ranked by change')}
            </Text>
            <Text variant="bodySmall" color="secondary">
              {t('drilldown-wide.ranked.subtitle', 'Metrics, logs and traces. One click narrows to a service.')}
            </Text>
          </Stack>
          <RankedTable services={showQuiet ? data.services : changed} showGroup={true} />
          {quiet.length > 0 && (
            <Stack alignItems="center" justifyContent="space-between">
              <Stack gap={1} alignItems="center">
                <Icon name="check-circle" />
                <Text color="secondary">
                  {t('drilldown-wide.ranked.quiet', '{{quiet}} services unchanged: {{names}}', {
                    quiet: quiet.length,
                    names: quiet
                      .slice(0, 3)
                      .map((service) => service.home.name)
                      .join(', '),
                  })}
                </Text>
              </Stack>
              <Button variant="secondary" fill="text" size="sm" onClick={() => setShowQuiet(!showQuiet)}>
                {showQuiet ? t('drilldown-wide.ranked.hide', 'Hide') : t('drilldown-wide.ranked.show', 'Show')}
              </Button>
            </Stack>
          )}
        </section>
        <ChangesList data={data} />
      </div>
    </>
  );
}

type Lens = 'explore' | 'slow' | 'errors' | 'version';

function lensSort(lens: Lens, services: WideService[]): WideService[] {
  const sorted = [...services];
  if (lens === 'slow') {
    sorted.sort((a, b) => Number(b.traces.changed) - Number(a.traces.changed) || b.slowRatio - a.slowRatio);
  } else if (lens === 'errors') {
    sorted.sort((a, b) => b.errorRate - a.errorRate);
  } else if (lens === 'version') {
    sorted.sort((a, b) => Number(b.home.newVersion) - Number(a.home.newVersion));
  }
  return sorted;
}

// Level 2: one namespace, with one column per signal. A lens re-ranks the same rows.
export function WideTeamView() {
  const [params] = useQueryParams();
  const requested = typeof params.group === 'string' ? params.group : undefined;
  return (
    <Shell level="team" group={requested}>
      {(data) => (
        <TeamBody data={data} group={requested && data.groups.includes(requested) ? requested : data.groups[0]} />
      )}
    </Shell>
  );
}

function TeamBody({ data, group }: { data: WideData; group: string }) {
  const styles = useStyles2(getStyles);
  const appUrls = getAppUrls(useNavModel('drilldown').node.children ?? []);
  const [lens, setLens] = useState<Lens>('explore');
  const members = data.services.filter((service) => service.group === group);
  const rows = lensSort(lens, members);
  const starts = members.filter((service) => service.changedSignals > 0).slice(0, 3);
  const versionCount = members.filter((service) => service.home.newVersion).length;

  const link = (app: AppId, service: WideService) => {
    const base = appUrls[app];
    return base ? scopedAppUrl(app, base, service.home.name) : undefined;
  };

  return (
    <>
      <Stack gap={2} alignItems="flex-end" wrap="wrap">
        <Field noMargin label={t('drilldown-wide.team.pick', 'Namespace')}>
          <Combobox
            width={32}
            value={group}
            options={data.groups.map((entry) => ({ label: groupLabel(entry), value: entry }))}
            onChange={(option) => option && goTo('team', { group: option.value })}
          />
        </Field>
        <RadioButtonGroup<Lens>
          value={lens}
          onChange={setLens}
          options={[
            { label: t('drilldown-wide.lens.explore', 'Just explore'), value: 'explore' },
            { label: t('drilldown-wide.lens.slow', 'Something is slow'), value: 'slow' },
            { label: t('drilldown-wide.lens.errors', 'Errors rising'), value: 'errors' },
            { label: t('drilldown-wide.lens.version', 'Verify a version'), value: 'version' },
          ]}
        />
        <Button variant="secondary" fill="text" icon="arrow-up" onClick={() => goTo('home')}>
          {t('drilldown-wide.team.back', 'Back to environment')}
        </Button>
      </Stack>
      {lens === 'version' && (
        <Text color="secondary">
          {t('drilldown-wide.lens.version-note', '{{changed}} of {{total}} services started a new service.version', {
            changed: versionCount,
            total: members.length,
          })}
        </Text>
      )}
      <div className={styles.split}>
        <section className={styles.section}>
          <Text element="h3" variant="h4">
            {t('drilldown-wide.team.table', 'Services in {{group}}, ranked by change', { group: groupLabel(group) })}
          </Text>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('drilldown-wide.table.service', 'Service')}</th>
                  <th>{t('drilldown-wide.signals.metrics', 'Metrics')}</th>
                  <th>{t('drilldown-wide.signals.logs', 'Logs')}</th>
                  <th>{t('drilldown-wide.signals.traces', 'Traces')}</th>
                  <th>{t('drilldown-wide.signals.profiles', 'Profiles')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((service) => (
                  <tr key={service.home.name}>
                    <td>
                      <Button
                        variant="primary"
                        fill="text"
                        size="sm"
                        onClick={() => goTo('service', { group, service: service.home.name })}
                      >
                        {service.home.name}
                      </Button>
                      {service.home.newVersion && (
                        <div className={styles.small}>
                          {t('drilldown-wide.table.new-version', 'version {{version}} started', {
                            version: service.home.version,
                          })}
                        </div>
                      )}
                    </td>
                    {[service.metrics, service.logs, service.traces, service.profiles].map((signal, index) => (
                      <td key={index} className={signal.changed ? styles.changedText : styles.mutedText}>
                        {signal.text}
                      </td>
                    ))}
                    <td>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => goTo('service', { group, service: service.home.name })}
                      >
                        {t('drilldown-wide.table.open', 'Open')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className={styles.side}>
          <Text element="h3" variant="h4">
            {t('drilldown-wide.start.title', 'Where to start')}
          </Text>
          {starts.length === 0 && (
            <Text color="secondary">
              {t('drilldown-wide.start.none', 'No signal changed in this namespace in the last 30 minutes.')}
            </Text>
          )}
          {starts.map((service) => {
            const app: AppId = service.metrics.changed ? 'metrics' : service.traces.changed ? 'traces' : 'logs';
            const href = link(app, service);
            return (
              <div key={service.home.name} className={styles.change}>
                <div>
                  <Text weight="medium">{`${service.home.name}: ${service.summary}`}</Text>
                  {href && (
                    <div>
                      <LinkButton href={href} size="sm" variant="secondary" fill="text" icon="external-link-alt">
                        {app === 'metrics'
                          ? t('drilldown-wide.start.open-metrics', 'Open in Metrics')
                          : app === 'traces'
                            ? t('drilldown-wide.start.open-traces', 'Open in Traces')
                            : t('drilldown-wide.start.open-logs', 'Open in Logs')}
                      </LinkButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <ChangesList data={data} group={group} />
        </aside>
      </div>
    </>
  );
}

// Level 3: one service with its four signals, and the other services of its namespace ranked on the left.
export function WideServiceView() {
  const [params] = useQueryParams();
  const requestedService = typeof params.service === 'string' ? params.service : undefined;
  return (
    <Shell level="service" service={requestedService}>
      {(data) => <ServiceBody data={data} requested={requestedService} />}
    </Shell>
  );
}

function ServiceBody({ data, requested }: { data: WideData; requested?: string }) {
  const styles = useStyles2(getStyles);
  const selected = data.services.find((service) => service.home.name === requested) ?? data.services[0];
  if (!selected) {
    return <Text color="secondary">{t('drilldown-wide.service.none', 'No services reported.')}</Text>;
  }
  const siblings = data.services.filter((service) => service.group === selected.group);

  return (
    <>
      <Stack gap={1}>
        <Button variant="secondary" fill="text" icon="arrow-up" onClick={() => goTo('team', { group: selected.group })}>
          {t('drilldown-wide.service.back', 'Back to {{group}}', { group: groupLabel(selected.group) })}
        </Button>
      </Stack>
      <div className={styles.serviceLayout}>
        <nav className={styles.rail} aria-label={t('drilldown-wide.rail.title', 'Other services in this namespace')}>
          <Text weight="medium">{t('drilldown-wide.rail.title', 'Other services in this namespace')}</Text>
          <Text variant="bodySmall" color="secondary">
            {t('drilldown-wide.rail.subtitle', 'Ranked by change')}
          </Text>
          {siblings.map((service) => (
            <button
              key={service.home.name}
              type="button"
              className={service.home.name === selected.home.name ? styles.railActive : styles.railItem}
              onClick={() => goTo('service', { group: service.group, service: service.home.name })}
            >
              <Text weight="medium">{service.home.name}</Text>
              <Text variant="bodySmall" color={service.impact === 'high' ? 'error' : 'secondary'}>
                {service.summary || t('drilldown-wide.table.nothing', 'No change')}
              </Text>
            </button>
          ))}
        </nav>
        <ServiceScope key={selected.home.name} service={selected.home} />
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  page: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }),
  chips: css({ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1) }),
  chip: css({
    display: 'inline-flex',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0, 1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.pill,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  chipKey: css({ color: theme.colors.text.secondary }),
  muted: css({ color: theme.colors.text.disabled }),
  strip: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  }),
  tile: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  split: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    [theme.breakpoints.down('lg')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
  }),
  section: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1.5), minWidth: 0 }),
  side: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    alignSelf: 'start',
  }),
  change: css({ display: 'flex', gap: theme.spacing(1), alignItems: 'flex-start' }),
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
  small: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
  trendCell: css({ width: 140, minWidth: 140 }),
  changedIcon: css({ color: theme.colors.error.text }),
  mutedIcon: css({ color: theme.colors.text.disabled }),
  changedText: css({ color: theme.colors.error.text }),
  mutedText: css({ color: theme.colors.text.secondary }),
  serviceLayout: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: '260px minmax(0, 1fr)',
    [theme.breakpoints.down('lg')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
  }),
  rail: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    alignSelf: 'start',
  }),
  railItem: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.25),
    padding: theme.spacing(1),
    textAlign: 'left',
    background: 'transparent',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    '&:hover': { background: theme.colors.action.hover },
  }),
  railActive: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.25),
    padding: theme.spacing(1),
    textAlign: 'left',
    background: theme.colors.action.selected,
    border: `1px solid ${theme.colors.primary.border}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
  }),
});
