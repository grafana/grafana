import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Link, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { type AppKey, SIGNALS, type SignalCoverage } from '../mockScenario';

import { getAppNames } from './DrilldownInsights';

interface Props {
  appUrls: Partial<Record<AppKey, string>>;
}

// Straight into a signal, without a scope. Each signal is part of one experience, and a signal
// that doesn't cover all of your services promotes its own setup.
export function DrilldownSignals({ appUrls }: Props) {
  const styles = useStyles2(getStyles);
  const appNames = getAppNames();

  return (
    <section className={styles.section} aria-labelledby="drilldown-signals-title">
      <Text element="h2" variant="h3" id="drilldown-signals-title">
        {t('drilldown-page.signals.title', 'Explore by signal')}
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
  const complete = signal.missing.length === 0;
  const counts = { covered: signal.covered, total: signal.total };
  const coverage =
    signal.unit === 'databases'
      ? t('drilldown-page.signals.coverage-databases', '{{covered}} of {{total}} databases', counts)
      : t('drilldown-page.signals.coverage-services', '{{covered}} of {{total}} services', counts);

  return (
    <div className={styles.tile}>
      {url ? (
        // Stretched over the whole tile, so the tile is the click target.
        <Link href={url} className={styles.stretched}>
          <Text weight="medium">{name}</Text>
        </Link>
      ) : (
        <Text weight="medium">{name}</Text>
      )}
      <Text variant="bodySmall" color="secondary">
        {signal.question}
      </Text>
      <Stack gap={0.5} alignItems="center">
        <Icon name={complete ? 'check-circle' : 'exclamation-circle'} className={complete ? styles.ok : styles.gap} />
        <Text variant="bodySmall" color={complete ? 'secondary' : 'warning'}>
          {coverage}
        </Text>
      </Stack>
      {!complete && url && (
        <LinkButton href={url} size="sm" variant="primary" fill="outline" icon="plus" className={styles.setup}>
          {t('drilldown-page.signals.setup', 'Set up for {{services}}', { services: signal.missing.join(', ') })}
        </LinkButton>
      )}
    </div>
  );
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
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      borderColor: theme.colors.border.strong,
    },
  }),
  stretched: css({
    color: 'inherit',
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: theme.shape.radius.default,
    },
    '&:focus-visible::after': getFocusStyles(theme),
  }),
  setup: css({
    // Above the stretched link, so it gets its own click.
    position: 'relative',
    zIndex: 1,
    marginTop: theme.spacing(0.5),
  }),
  ok: css({
    color: theme.colors.success.text,
  }),
  gap: css({
    color: theme.colors.warning.text,
  }),
});
