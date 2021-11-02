import React from 'react';
import { mount } from 'enzyme';
import { dateMath, VizOrientation, LoadingState, dateTime, toDataFrame, } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { BarGaugePanel } from './BarGaugePanel';
var valueSelector = selectors.components.Panels.Visualization.BarGauge.value;
describe('BarGaugePanel', function () {
    describe('when empty result is rendered', function () {
        var wrapper = createBarGaugePanelWithData({
            series: [],
            timeRange: createTimeRange(),
            state: LoadingState.Done,
        });
        it('should render with title "No data"', function () {
            var displayValue = wrapper.find("div[aria-label=\"" + valueSelector + "\"]").text();
            expect(displayValue).toBe('No data');
        });
    });
    describe('when there is data', function () {
        var wrapper = createBarGaugePanelWithData({
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
        it('should render with title "No data"', function () {
            var displayValue = wrapper.find("div[aria-label=\"" + valueSelector + "\"]").text();
            expect(displayValue).toBe('100');
        });
    });
});
function createTimeRange() {
    return {
        from: dateMath.parse('now-6h') || dateTime(),
        to: dateMath.parse('now') || dateTime(),
        raw: { from: 'now-6h', to: 'now' },
    };
}
function createBarGaugePanelWithData(data) {
    var timeRange = createTimeRange();
    var options = {
        displayMode: BarGaugeDisplayMode.Lcd,
        reduceOptions: {
            calcs: ['mean'],
            values: false,
        },
        orientation: VizOrientation.Horizontal,
        showUnfilled: true,
    };
    var fieldConfig = {
        defaults: {},
        overrides: [],
    };
    return mount(React.createElement(BarGaugePanel, { id: 1, data: data, timeRange: timeRange, timeZone: 'utc', options: options, title: "hello", fieldConfig: fieldConfig, onFieldConfigChange: function () { }, onOptionsChange: function () { }, onChangeTimeRange: function () { }, replaceVariables: function (s) { return s; }, renderCounter: 0, width: 532, transparent: false, height: 250, eventBus: {} }));
}
//# sourceMappingURL=BarGaugePanel.test.js.map