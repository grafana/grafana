import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  createDataFrame,
  createTheme,
  dateTime,
  FieldConfigOptionsRegistry,
  FieldType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { getPanelProps } from '../test-utils';

import { CandlestickPanel } from './CandlestickPanel';
import { defaultOptions } from './defaultOptions';
import { type Options, VizDisplayMode } from './panelcfg.gen';

it('opens late-arriving candlestick exemplars without recreating the chart', async () => {
  const from = Date.UTC(2026, 9, 15, 10);
  const to = Date.UTC(2026, 9, 15, 11);
  const time = (from + to) / 2;
  const props = getPanelProps({ ...defaultOptions, mode: VizDisplayMode.Candles } as Options, {
    timeRange: {
      from: dateTime(from),
      to: dateTime(to),
      raw: { from: dateTime(from), to: dateTime(to) },
    },
  });
  const [series, exemplar] = applyFieldOverrides({
    data: [
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [from, time, to] },
          { name: 'open', type: FieldType.number, values: [10, 11, 12] },
          { name: 'high', type: FieldType.number, values: [13, 14, 15] },
          { name: 'low', type: FieldType.number, values: [9, 10, 11] },
          { name: 'close', type: FieldType.number, values: [12, 13, 14] },
        ],
      }),
      createDataFrame({
        name: 'exemplar',
        fields: [
          { name: 'Time', type: FieldType.time, values: [time] },
          { name: 'Value', type: FieldType.number, values: [12] },
          { name: 'traceID', type: FieldType.string, values: ['late-candlestick-trace'] },
        ],
      }),
    ],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (value) => value,
    theme: createTheme(),
    fieldConfigRegistry: new FieldConfigOptionsRegistry(),
  });
  props.data = { ...props.data, series: [series], annotations: undefined, structureRev: 1 };
  const { rerender } = render(<CandlestickPanel {...props} />);
  const chart = await screen.findByTestId('uplot-main-div');
  await waitFor(() => expect(chart.querySelector('.u-over')).toBeVisible());
  const plotOverlay = chart.querySelector('.u-over');
  expect(screen.queryByTestId(selectors.components.UPlotChart.xyCanvas)).not.toBeInTheDocument();

  rerender(<CandlestickPanel {...props} data={{ ...props.data, annotations: [exemplar] }} />);

  await userEvent.click(await screen.findByTestId(selectors.components.DataSource.Prometheus.exemplarMarker));
  expect(await screen.findByText('late-candlestick-trace')).toBeVisible();
  expect(chart.querySelector('.u-over')).toBe(plotOverlay);
});
