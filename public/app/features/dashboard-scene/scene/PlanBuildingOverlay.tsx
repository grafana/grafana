import { css, keyframes } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { PlanBuildingAnimation } from './PlanBuildingAnimation';

const QUIP_INTERVAL_MS = 2800;

function getQuips(): string[] {
  return [
    t('dashboard.plan-building-overlay.quip-gridlines', 'Lining up the gridlines…'),
    t('dashboard.plan-building-overlay.quip-blue', 'Picking a nice shade of blue…'),
    t('dashboard.plan-building-overlay.quip-metrics', 'Asking the metrics nicely…'),
    t('dashboard.plan-building-overlay.quip-pie-charts', 'Arguing about pie charts…'),
    t('dashboard.plan-building-overlay.quip-legend', 'Teaching the legend to behave…'),
    t('dashboard.plan-building-overlay.quip-series', 'Untangling the time series…'),
    t('dashboard.plan-building-overlay.quip-corners', 'Polishing the panel corners…'),
    t('dashboard.plan-building-overlay.quip-points', 'Rounding up the data points…'),
  ];
}

/**
 * Fills the empty dashboard between the user choosing Build on a plan and the builder's first
 * write, while the assistant prepares the build, so the wait reads as work in progress rather
 * than a blank page.
 */
export function PlanBuildingOverlay() {
  const styles = useStyles2(getStyles);
  const quips = getQuips();
  const [quipIndex, setQuipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setQuipIndex((index) => index + 1), QUIP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container} data-testid="dashboard-plan-building-overlay">
      <PlanBuildingAnimation />
      <div role="status">
        <Text element="h2" variant="h4">
          <Trans i18nKey="dashboard.plan-building-overlay.title">Preparing to build your dashboard</Trans>
        </Text>
      </div>
      {/* Decorative, so kept out of the status region: a screen reader should hear the heading once,
          not every quip. Keyed so each quip fades in afresh. */}
      <div className={styles.quip} aria-hidden="true">
        <span key={quipIndex} className={styles.quipText}>
          <Text color="secondary">{quips[quipIndex % quips.length]}</Text>
        </span>
      </div>
    </div>
  );
}

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing(2),
      minHeight: '100%',
      padding: theme.spacing(4, 2),
      textAlign: 'center',
    }),
    // Holds one line's height so the layout stays put as quips of different lengths swap in.
    quip: css({
      minHeight: theme.spacing(3),
    }),
    quipText: css({
      display: 'inline-block',
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${fadeIn} ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeOut}`,
      },
    }),
  };
}
