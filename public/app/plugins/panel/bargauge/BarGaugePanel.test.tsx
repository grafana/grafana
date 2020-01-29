import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { PanelData, dateMath, TimeRange, VizOrientation, PanelProps } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';

import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugeOptions } from './types';

describe('BarGaugePanel', () => {
  describe('when empty result is rendered', () => {
    const wrapper = createBarGaugePanelWithData({
      series: [],
      timeRange: null,
      state: null,
    });

    it('should render with title "No data"', () => {
      const displayValue = wrapper.find('div.bar-gauge__value').text();
      expect(displayValue).toBe('No data');
    });
  });
});

function createBarGaugePanelWithData(data: PanelData): ReactWrapper<PanelProps<BarGaugeOptions>> {
  const timeRange: TimeRange = {
    from: dateMath.parse('now-6h'),
    to: dateMath.parse('now'),
    raw: { from: 'now-6h', to: 'now' },
  };

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
