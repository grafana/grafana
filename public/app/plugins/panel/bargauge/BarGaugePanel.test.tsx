import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import {
  PanelData,
  dateMath,
  TimeRange,
  VizOrientation,
  PanelProps,
  LoadingState,
  dateTime,
  FieldConfigSource,
  toDataFrame,
} from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugeOptions } from './types';

const valueSelector = selectors.components.Panels.Visualization.BarGauge.value;

describe('BarGaugePanel', () => {
  describe('when empty result is rendered', () => {
    const wrapper = createBarGaugePanelWithData({
      series: [],
      timeRange: createTimeRange(),
      state: LoadingState.Done,
    });

    it('should render with title "No data"', () => {
      const displayValue = wrapper.find(`div[aria-label="${valueSelector}"]`).text();
      expect(displayValue).toBe('No data');
    });
  });

  describe('when there is data', () => {
    const wrapper = createBarGaugePanelWithData({
      series: [
        toDataFrame({
          target: 'test',
          datapoints: [
            [100, 1000],
            [100, 200],
          ],
        }),
      ],
      timeRange: createTimeRange(),
      state: LoadingState.Done,
    });

    it('should render with title "No data"', () => {
      const displayValue = wrapper.find(`div[aria-label="${valueSelector}"]`).text();
      expect(displayValue).toBe('100');
    });
  });
});

function createTimeRange(): TimeRange {
  return {
    from: dateMath.parse('now-6h') || dateTime(),
    to: dateMath.parse('now') || dateTime(),
    raw: { from: 'now-6h', to: 'now' },
  };
}

function createBarGaugePanelWithData(data: PanelData): ReactWrapper<PanelProps<BarGaugeOptions>> {
  const timeRange = createTimeRange();

  const options: BarGaugeOptions = {
    displayMode: BarGaugeDisplayMode.Lcd,
    reduceOptions: {
      calcs: ['mean'],
      values: false,
    },
    orientation: VizOrientation.Horizontal,
    showUnfilled: true,
  };
  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  return mount<BarGaugePanel>(
    <BarGaugePanel
      id={1}
      data={data}
      timeRange={timeRange}
      timeZone={'utc'}
      options={options}
      title="hello"
      fieldConfig={fieldConfig}
      onFieldConfigChange={() => {}}
      onOptionsChange={() => {}}
      onChangeTimeRange={() => {}}
      replaceVariables={s => s}
      renderCounter={0}
      width={532}
      transparent={false}
      height={250}
    />
  );
}
