import React from 'react';

import { QueryEditorHelpProps } from '@grafana/data';

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

const PromCheatSheet = (props: QueryEditorHelpProps<PromQuery>) => (
  <div>
    <h2>PromQL Cheat Sheet</h2>
    {CHEAT_SHEET_ITEMS.map((item, index) => (
      <div className="cheat-sheet-item" key={index}>
        <div className="cheat-sheet-item__title">{item.title}</div>
        {item.expression ? (
          <button
            type="button"
            className="cheat-sheet-item__example"
            onClick={(e) => props.onClickExample({ refId: 'A', expr: item.expression })}
          >
            <code>{item.expression}</code>
          </button>
        ) : null}
        <div className="cheat-sheet-item__label">{item.label}</div>
      </div>
    ))}
  </div>
);

export default PromCheatSheet;
