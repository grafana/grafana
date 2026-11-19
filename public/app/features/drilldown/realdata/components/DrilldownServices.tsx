import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, formattedValueToString, getValueFormat } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Combobox, type ComboboxOption, Stack, Text, useStyles2 } from '@grafana/ui';

import { getUrlDataSource } from '../../dataSources';
import { getUrlEnvironment } from '../../environment';
import { appServiceUrl } from '../appLinks';
import {
  type AppKey,
  NOTES,
  SCOPE_VALUES,
  SPAN_METRICS,
  type Scope,
  type ScopeType,
  YOUR_SERVICES,
} from '../liveScenario';
import { type ChartState, type ServiceCharts, loadServiceCharts } from '../serviceCharts';

import { getAppNames } from './DrilldownInsights';
import { ServiceChart } from './ServiceChart';
import { ServiceStat } from './ServiceStat';
import { emptyText } from './emptyText';

// The list starts with this many services, and each click on the button adds this many more.
const PAGE_SIZE = 4;

// A value from a data source can hold a slash. React escapes text when it draws it, so i18next leaves values as they are.
const RAW = { interpolation: { escapeValue: false } };

interface Props {
  onPick: (scope: Scope) => void;
  appUrls: Partial<Record<AppKey, string>>;
}

// Scope without a hint or a question: a service you know, or any service, environment or namespace.
export function DrilldownServices({ onPick, appUrls }: Props) {
  const styles = useStyles2(getStyles);
  const [browsing, setBrowsing] = useState(false);
  const [scopeType, setScopeType] = useState<ScopeType>('service');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const scopeTypeOptions: Array<ComboboxOption<ScopeType>> = [
    { value: 'service', label: t('drilldown-real.services.scope-service', 'Service') },
    { value: 'environment', label: t('drilldown-real.services.scope-environment', 'Environment') },
    { value: 'namespace', label: t('drilldown-real.services.scope-namespace', 'Namespace') },
  ];

  return (
    <section className={styles.section} aria-labelledby="drilldown-services-title">
      <Stack alignItems="center" wrap="wrap" gap={2}>
        <Text element="h2" variant="h3" id="drilldown-services-title">
          {t('drilldown-real.services.title', 'Your services')}
        </Text>
        {browsing ? (
          <Stack gap={1} alignItems="center">
            <Combobox
              width={18}
              options={scopeTypeOptions}
              value={scopeType}
              aria-label={t('drilldown-real.services.scope-type-label', 'Scope type')}
              onChange={(option) => setScopeType(option.value)}
            />
            <Combobox
              width={24}
              options={SCOPE_VALUES[scopeType].map((value) => ({ value }))}
              value={null}
              placeholder={t('drilldown-real.services.scope-value-placeholder', 'Pick a value')}
              aria-label={t('drilldown-real.services.scope-value-label', 'Scope value')}
              onChange={(option) => onPick({ type: scopeType, value: option.value })}
            />
          </Stack>
        ) : (
          <Button size="sm" variant="secondary" icon="search" onClick={() => setBrowsing(true)}>
            {t('drilldown-real.services.browse', 'Browse all services')}
          </Button>
        )}
      </Stack>
      {YOUR_SERVICES.length === 0 && <Text color="secondary">{emptyMessage(getUrlEnvironment())}</Text>}
      <div className={styles.rows}>
        {YOUR_SERVICES.slice(0, visible).map((service) => (
          <ServiceRow
            key={service}
            service={service}
            appUrls={appUrls}
            onPick={() => onPick({ type: 'service', value: service })}
          />
        ))}
      </div>
      {visible < YOUR_SERVICES.length && (
        <div>
          <Button variant="secondary" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
            {t('drilldown-real.services.show-more', 'Show {{number}} more', { number: PAGE_SIZE })}
          </Button>
        </div>
      )}
    </section>
  );
}

// A traces data source that did not answer says nothing about the services, so the list says it was not measured.
function emptyMessage(environment: string | undefined) {
  if (NOTES.some((note) => note.source === 'traces')) {
    return t('drilldown-real.services.not-measured', 'Not measured: see the notice in the header');
  }
  return environment
    ? t(
        'drilldown-real.services.none-in-environment',
        'No services found in traces for {{environment}} in the last 30 minutes',
        { environment, ...RAW }
      )
    : t('drilldown-real.services.none', 'No services found in traces in the last 30 minutes');
}

// What the chart's selector matched in its data source, which a chart that found nothing still knows.
const matchedValue = (state: ChartState | undefined) =>
  state?.kind === 'data' || state?.kind === 'empty' ? state.value : undefined;

const formatMs = (value: number) => formattedValueToString(getValueFormat('ms')(value));

const formatCount = (value: number) =>
  formattedValueToString(getValueFormat('short')(value, value >= 10 || Number.isInteger(value) ? 0 : 1));

const formatCores = (value: number) => String(Number(value.toFixed(2)));

interface RowProps {
  service: string;
  appUrls: Props['appUrls'];
  onPick: () => void;
}

// A row asks for its charts when it shows, so only the services on the page cost queries.
function ServiceRow({ service, appUrls, onPick }: RowProps) {
  const styles = useStyles2(getStyles);
  const apps = getAppNames();
  const [charts, setCharts] = useState<ServiceCharts>();
  const environment = getUrlEnvironment();

  useEffect(() => {
    let cancelled = false;
    loadServiceCharts(service, environment).then((loaded) => {
      if (!cancelled) {
        setCharts(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [service, environment]);

  // Each app takes the name its own data source uses. Logs and Profiles have it once their query has looked it up, and
  // a service with no such name has no link there.
  const logsValue = matchedValue(charts?.logs);
  const profilesValue = matchedValue(charts?.profiles);
  const open = (app: AppKey, name: string | undefined) =>
    name === undefined ? undefined : appServiceUrl(app, appUrls[app], name, SPAN_METRICS.service);
  const subject = { service, environment };
  const from = (value: string | undefined) => (value && value !== service ? value : undefined);
  const sql: ChartState = getUrlDataSource('sql') ? { kind: 'empty' } : { kind: 'no-source' };

  return (
    <div className={styles.row}>
      <div>
        <Button variant="secondary" fill="text" onClick={onPick}>
          {service}
        </Button>
      </div>
      <div className={styles.molecule}>
        <div className={styles.traces}>
          <ServiceChart
            icon="gf-traces"
            title={apps.traces}
            subtitle={t('drilldown-real.services.traces-subtitle', 'Requests per minute by status')}
            state={charts?.traces}
            emptyText={emptyText('traces', charts?.traces, subject)}
            openLabel={t('drilldown-real.services.view-traces', 'View traces')}
            openUrl={open('traces', service)}
          />
        </div>
        <ServiceStat
          icon="chart-line"
          title={apps.metrics}
          caption={t('drilldown-real.services.metrics-caption', 'p95 latency')}
          state={charts?.metrics}
          format={formatMs}
          emptyText={emptyText('metrics', charts?.metrics, subject)}
          appName={apps.metrics}
          openUrl={open('metrics', service)}
        />
        <ServiceStat
          icon="gf-logs"
          title={apps.logs}
          caption={
            from(logsValue)
              ? t('drilldown-real.services.logs-caption-from', 'Error lines per minute, from {{value}}', {
                  value: logsValue,
                  ...RAW,
                })
              : t('drilldown-real.services.logs-caption', 'Error lines per minute')
          }
          state={charts?.logs}
          format={formatCount}
          tone={(value) => (value > 0 ? 'error' : 'neutral')}
          emptyText={emptyText('logs', charts?.logs, subject)}
          appName={apps.logs}
          openUrl={open('logs', logsValue)}
        />
        <ServiceStat
          icon="fire"
          title={apps.profiles}
          caption={
            from(profilesValue)
              ? t('drilldown-real.services.profiles-caption-from', 'CPU cores, from {{value}}', {
                  value: profilesValue,
                  ...RAW,
                })
              : t('drilldown-real.services.profiles-caption', 'CPU cores')
          }
          state={charts?.profiles}
          format={formatCores}
          emptyText={emptyText('profiles', charts?.profiles, subject)}
          appName={apps.profiles}
          openUrl={open('profiles', profilesValue)}
        />
        <ServiceStat
          icon="database"
          title={apps.sql}
          caption={t('drilldown-real.services.sql-caption', 'Slow queries per minute')}
          state={sql}
          format={String}
          emptyText={t('drilldown-real.services.sql-not-measured', 'Not measured: nothing queries SQL yet')}
          appName={apps.sql}
        />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  rows: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  }),
  row: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  // The traces panel stands left over two rows of cards, as in the design.
  molecule: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'minmax(0, 2fr) repeat(2, minmax(0, 1fr))',
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  }),
  traces: css({
    gridRow: 'span 2',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: {
      gridColumn: '1 / -1',
      gridRow: 'auto',
    },
  }),
});
