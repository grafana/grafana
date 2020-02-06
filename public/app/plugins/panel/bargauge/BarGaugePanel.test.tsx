import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { PanelData, dateMath, TimeRange, VizOrientation, PanelProps, LoadingState, dateTime } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';

import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugeOptions } from './types';

describe('BarGaugePanel', () => {
  describe('when empty result is rendered', () => {
    const wrapper = createBarGaugePanelWithData({
      series: [],
      timeRange: createTimeRange(),
      state: LoadingState.Done,
    });

    it('should render with title "No data"', () => {
      const displayValue = wrapper.find('div.bar-gauge__value').text();
      expect(displayValue).toBe('No data');
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
    fieldOptions: {
      calcs: ['mean'],
      defaults: {},
      values: false,
      overrides: [],
    },
    orientation: VizOrientation.Horizontal,
    showUnfilled: true,
  };

  return mount<BarGaugePanel>(
    <BarGaugePanel
      id={1}
      data={data}
      timeRange={timeRange}
      timeZone={'utc'}
      options={options}
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
