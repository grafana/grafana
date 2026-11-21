import { css } from '@emotion/css';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { type AppKey, SIGNALS, type SignalCoverage } from '../liveScenario';

import { getAppNames } from './DrilldownInsights';

interface Props {
  appUrls: Partial<Record<AppKey, string>>;
}

const ICONS: Record<AppKey, IconName> = {
  metrics: 'chart-line',
  logs: 'gf-logs',
  traces: 'gf-traces',
  profiles: 'fire',
  sql: 'database',
};

// Straight into a signal, without a scope. A signal with no data source says so and offers to set it up.
export function DrilldownSignals({ appUrls }: Props) {
  const styles = useStyles2(getStyles);
  const appNames = getAppNames();

  return (
    <section className={styles.section} aria-labelledby="drilldown-signals-title">
      <Text element="h2" variant="h3" id="drilldown-signals-title">
        {t('drilldown-real.signals.title', 'Start from a signal')}
      </Text>
      <div className={styles.grid}>
        {SIGNALS.map((signal) => (
          <SignalTile key={signal.app} signal={signal} name={appNames[signal.app]} url={appUrls[signal.app]} />
        ))}
      </div>
    </section>
  );
}

function SignalTile({ signal, name, url }: { signal: SignalCoverage; name: string; url?: string }) {
  const styles = useStyles2(getStyles);
  const texts = getTexts()[signal.app];
  const notSetUp = Boolean(signal.noSource);

  return (
    <div className={styles.tile}>
      <Stack gap={1} alignItems="center">
        <Icon name={ICONS[signal.app]} />
        <Text weight="medium">{name}</Text>
      </Stack>
      <Text variant="bodySmall" color="secondary">
        {notSetUp
          ? `${t('drilldown-real.signals.not-set-up', 'Not set up yet.')} ${texts.description}`
          : texts.description}
      </Text>
      {url && (
        <div className={styles.action}>
          <LinkButton href={url} size="sm" variant={notSetUp ? 'primary' : 'secondary'}>
            {notSetUp ? texts.configure : texts.view}
          </LinkButton>
        </div>
      )}
    </div>
  );
}

function getTexts(): Record<AppKey, { description: string; view: string; configure: string }> {
  return {
    metrics: {
      description: t('drilldown-real.signals.metrics-description', 'Browse every metric by label, no PromQL needed.'),
      view: t('drilldown-real.signals.metrics-view', 'View all metrics'),
      configure: t('drilldown-real.signals.metrics-configure', 'Configure metrics'),
    },
    logs: {
      description: t('drilldown-real.signals.logs-description', 'See log volume and patterns for each service.'),
      view: t('drilldown-real.signals.logs-view', 'View all logs'),
      configure: t('drilldown-real.signals.logs-configure', 'Configure logs'),
    },
    traces: {
      description: t('drilldown-real.signals.traces-description', 'Find slow and failing requests across services.'),
      view: t('drilldown-real.signals.traces-view', 'View all traces'),
      configure: t('drilldown-real.signals.traces-configure', 'Configure traces'),
    },
    profiles: {
      description: t('drilldown-real.signals.profiles-description', 'See which function burns the CPU or memory.'),
      view: t('drilldown-real.signals.profiles-view', 'View all profiles'),
      configure: t('drilldown-real.signals.profiles-configure', 'Configure profiles'),
    },
    sql: {
      description: t(
        'drilldown-real.signals.sql-description',
        'See slow queries in your Postgres and MySQL databases.'
      ),
      view: t('drilldown-real.signals.sql-view', 'View all SQL'),
      configure: t('drilldown-real.signals.sql-configure', 'Configure SQL'),
    },
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  grid: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  }),
  tile: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  // Pinned to the bottom, so the buttons of tiles with texts of different lengths sit on one line.
  action: css({
    marginTop: 'auto',
    paddingTop: theme.spacing(1),
  }),
});
