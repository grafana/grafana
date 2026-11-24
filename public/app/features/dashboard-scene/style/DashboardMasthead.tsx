import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { dateTimeFormat, type GrafanaTheme2, rangeUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { ReportProse } from 'app/core/components/ReportProse/ReportProse';
import { dashVar } from 'app/core/dashboardStyle/cssVars';

import { type DashboardScene } from '../scene/DashboardScene';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

import { useDataSourceNames } from './useDataSourceNames';

/**
 * Opens a dashboard that states a finding: a headline title, one line of scope (period, time zone,
 * sources, as of) and the lede. The scope line is derived from the dashboard, so it never drifts
 * from what the panels show.
 */
export function DashboardMasthead({ dashboard }: { dashboard: DashboardScene }) {
  const { title, lede } = dashboard.useState();
  return lede?.trim() ? <Masthead dashboard={dashboard} title={title} lede={lede} /> : null;
}

function Masthead({ dashboard, title, lede }: { dashboard: DashboardScene; title: string; lede: string }) {
  const timeRange = sceneGraph.getTimeRange(dashboard);
  const { value, from, to, timeZone } = timeRange.useState();
  const styles = useStyles2(getStyles);
  const sources = useDashboardSourceNames(dashboard);

  const period = rangeUtil.describeTimeRange({ from, to }, timeZone);
  const zone = timeRange.getTimeZone();
  const asOf = dateTimeFormat(value.to, { format: 'D MMM YYYY, HH:mm', timeZone: zone });
  const scope = [
    period,
    zone === 'browser' ? t('dashboard.masthead.local-time', 'local time') : zone,
    sources.length > 0 &&
      t('dashboard.masthead.sources', 'Source: {{sources}}', {
        sources: sources.join(', '),
        interpolation: { escapeValue: false },
      }),
    t('dashboard.masthead.as-of', 'As of {{time}}', { time: asOf, interpolation: { escapeValue: false } }),
  ].filter(Boolean);

  return (
    <header className={styles.masthead} data-testid={selectors.components.DashboardStyle.masthead}>
      <h1 className={cx(styles.title, 'dashboard-masthead-title')}>{title}</h1>
      <p className={styles.scope}>
        {scope.map((part, index) => (
          <span key={index} className={styles.scopePart}>
            {part}
          </span>
        ))}
      </p>
      <ReportProse markdown={lede} className={cx(styles.lede, 'dashboard-emphasis')} />
    </header>
  );
}

/** Names of the data sources behind the dashboard's panels, in first-use order. */
function useDashboardSourceNames(dashboard: DashboardScene): string[] {
  const { body } = dashboard.useState();
  const refs = useMemo(
    () =>
      body.getVizPanels().flatMap((panel) => {
        const runner = getQueryRunnerFor(panel);
        if (!runner || runner.state.queries.length === 0) {
          return [];
        }
        return [runner.state.datasource, ...runner.state.queries.map((query) => query.datasource)];
      }),
    [body]
  );
  return useDataSourceNames(refs);
}

function getStyles(theme: GrafanaTheme2) {
  const muted = dashVar('muted', theme.colors.text.secondary);
  return {
    masthead: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(2, 0, 3),
      marginBottom: theme.spacing(1),
      borderBottom: `var(--dash-section-rule, 1px solid ${theme.colors.border.weak})`,
    }),
    title: css({
      margin: 0,
      maxWidth: '24ch',
      fontFamily: dashVar('fontDisplay', theme.typography.fontFamily),
      fontSize: `var(--dash-masthead-size, 2.25rem)`,
      lineHeight: 1.08,
      fontWeight: dashVar('headingWeight', String(theme.typography.fontWeightMedium)),
      letterSpacing: dashVar('headingTracking', '-0.01em'),
      color: dashVar('ink', theme.colors.text.primary),
      textWrap: 'balance',
      [theme.breakpoints.down('md')]: {
        fontSize: 'calc(var(--dash-masthead-size, 2.25rem) * 0.72)',
      },
    }),
    scope: css({
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: theme.spacing(1.5),
      rowGap: theme.spacing(0.25),
      margin: 0,
      fontFamily: dashVar('fontMono', theme.typography.fontFamilyMonospace),
      fontSize: '0.8125rem',
      color: muted,
    }),
    scopePart: css({
      '& + &::before': {
        content: '"·"',
        marginRight: theme.spacing(1.5),
        opacity: 0.7,
      },
    }),
    lede: css({
      marginTop: theme.spacing(0.5),
      fontSize: '1.1875rem',
      lineHeight: 1.5,
      maxWidth: '62ch',
      color: dashVar('ink', theme.colors.text.primary),
      '& p': { margin: 0 },
    }),
  };
}
