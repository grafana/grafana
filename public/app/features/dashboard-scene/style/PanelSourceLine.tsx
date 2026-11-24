import { css } from '@emotion/css';

import { type GrafanaTheme2, rangeUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { dashVar } from 'app/core/dashboardStyle/cssVars';

import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

import { useDataSourceNames } from './useDataSourceNames';

export const SOURCE_LINE_HEIGHT = 22;

/**
 * A newsroom-style source line under a panel: where its data comes from, how many queries, the
 * period it covers and the interval it is aggregated to. Derived from the panel's own query
 * runner and time range, so a panel time shift or override shows up here.
 */
export function PanelSourceLine({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getStyles);
  const runner = getQueryRunnerFor(panel);
  const timeRange = sceneGraph.getTimeRange(panel);
  const { from, to, timeZone } = timeRange.useState();
  const runnerState = runner?.useState();
  const names = useDataSourceNames(
    runnerState ? [runnerState.datasource, ...runnerState.queries.map((query) => query.datasource)] : []
  );

  if (!runner || !runnerState || runnerState.queries.length === 0) {
    return null;
  }

  const interval = runnerState.data?.request?.interval;
  const queryCount = runnerState.queries.filter((query) => !query.hide).length;
  const parts = [
    names.length > 0 && names.join(', '),
    t('dashboard.source-line.queries', '', {
      count: queryCount,
      defaultValue_one: '{{count}} query',
      defaultValue_other: '{{count}} queries',
    }),
    rangeUtil.describeTimeRange({ from, to }, timeZone),
    interval && t('dashboard.source-line.interval', '{{interval}} interval', { interval }),
  ].filter(Boolean);

  return (
    <p className={styles.line} data-testid={selectors.components.DashboardStyle.sourceLine}>
      <span className={styles.label}>{t('dashboard.source-line.label', 'Source')}</span>
      {parts.join(' · ')}
    </p>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    line: css({
      position: 'absolute',
      left: theme.spacing(1),
      right: theme.spacing(1),
      bottom: 0,
      height: SOURCE_LINE_HEIGHT,
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      borderTop: `1px solid ${dashVar('line', theme.colors.border.weak)}`,
      fontFamily: dashVar('fontMono', theme.typography.fontFamilyMonospace),
      fontSize: '0.6875rem',
      letterSpacing: '0.01em',
      color: dashVar('muted', theme.colors.text.secondary),
    }),
    label: css({
      color: dashVar('ink', theme.colors.text.primary),
      fontWeight: 500,
    }),
  };
}
