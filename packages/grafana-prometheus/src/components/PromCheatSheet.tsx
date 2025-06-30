// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PromCheatSheet.tsx
import { css } from '@emotion/css';

import { GrafanaTheme2, QueryEditorHelpProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { PromQuery } from '../types';

const CHEAT_SHEET_ITEMS = [
  {
    title: 'Request Rate',
    expression: 'rate(http_request_total[5m])',
    label:
      'Given an HTTP request counter, this query calculates the per-second average request rate over the last 5 minutes.',
  },
  {
    title: '95th Percentile of Request Latencies',
    expression: 'histogram_quantile(0.95, sum(rate(prometheus_http_request_duration_seconds_bucket[5m])) by (le))',
    label: 'Calculates the 95th percentile of HTTP request rate over 5 minute windows.',
  },
  {
    title: 'Alerts Firing',
    expression: 'sort_desc(sum(sum_over_time(ALERTS{alertstate="firing"}[24h])) by (alertname))',
    label: 'Sums up the alerts that have been firing over the last 24 hours.',
  },
  {
    title: 'Step',
    label:
      'Defines the graph resolution using a duration format (15s, 1m, 3h, ...). Small steps create high-resolution graphs but can be slow over larger time ranges. Using a longer step lowers the resolution and smooths the graph by producing fewer datapoints. If no step is given the resolution is calculated automatically.',
  },
];

export const PromCheatSheet = (props: QueryEditorHelpProps<PromQuery>) => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <h2>
        <Trans i18nKey="grafana-prometheus.components.prom-cheat-sheet.prom-ql-cheat-sheet">PromQL Cheat Sheet</Trans>
      </h2>
      {CHEAT_SHEET_ITEMS.map((item, index) => (
        <div className={styles.cheatSheetItem} key={index}>
          <div className={styles.cheatSheetItemTitle}>{item.title}</div>
          {item.expression ? (
            <button
              type="button"
              className={styles.cheatSheetExample}
              onClick={(e) => props.onClickExample({ refId: 'A', expr: item.expression })}
            >
              <code>{item.expression}</code>
            </button>
          ) : null}
          {item.label}
        </div>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  cheatSheetItem: css({
    margin: theme.spacing(3, 0),
  }),
  cheatSheetItemTitle: css({
    fontSize: theme.typography.h3.fontSize,
  }),
  cheatSheetExample: css({
    margin: theme.spacing(0.5, 0),
    // element is interactive, clear button styles
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    display: 'block',
  }),
});
