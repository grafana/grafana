import { createDataFrame, FieldType } from '@grafana/data';

import { buildMetricsItem } from './buildMetricsItem';
import { type MetricsOverview } from './metricsData';
import { readSeries } from './promQuery';

function overview(dataPointsPerMinute: number | null): MetricsOverview {
  return {
    activeSeries: 906_600_000,
    dataPointsPerMinute,
    queries: {
      datasourceUid: 'prometheus',
      activeSeries: 'sum(prometheus_tsdb_head_series)',
      dataPointsPerMinute: '60 * sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))',
    },
  };
}

describe('buildMetricsItem', () => {
  it('builds the formatted Metrics card with history and drilldown link', () => {
    const history = readSeries(
      [
        createDataFrame({
          refId: 'history',
          fields: [
            { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'Value', type: FieldType.number, values: [100, 110, 120] },
          ],
        }),
      ],
      'history'
    );
    expect(history).not.toBeNull();

    const item = buildMetricsItem(overview(41_940), history, true);

    expect(item).toMatchObject({
      id: 'metrics',
      title: 'Metrics & infrastructure',
      stats: {
        primary: '907 Mil series',
        secondary: '41.9 K data points/min',
      },
      sparkline: {
        series: history,
        caption: 'Active series · last 24h',
      },
      sparklineLoading: true,
      action: 'Open metrics',
      href: '/a/grafana-metricsdrilldown-app/drilldown',
    });
  });

  it.each([null, 0])('omits the secondary stat and sparkline when data points per minute are %s', (value) => {
    const item = buildMetricsItem(overview(value), null);

    expect(item.stats).toEqual({
      primary: '907 Mil series',
      secondary: undefined,
    });
    expect(item.sparkline).toBeUndefined();
    expect(item.sparklineLoading).toBe(false);
  });
});
