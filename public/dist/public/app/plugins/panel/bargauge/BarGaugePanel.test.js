import { render, screen } from '@testing-library/react';
import { uniqueId } from 'lodash';
import React from 'react';
import { dateMath, dateTime, LoadingState, toDataFrame, VizOrientation } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { BarGaugeDisplayMode, BarGaugeValueMode } from '@grafana/schema';
import { BarGaugeNamePlacement } from '@grafana/schema/dist/esm/common/common.gen';
import { BarGaugePanel } from './BarGaugePanel';
const valueSelector = selectors.components.Panels.Visualization.BarGauge.valueV2;
describe('BarGaugePanel', () => {
    describe('when there is no data', () => {
        it('show a "No Data" message', () => {
            const panelData = buildPanelData();
            render(React.createElement(BarGaugePanel, Object.assign({}, panelData)));
            expect(screen.getByText(/no data/i)).toBeInTheDocument();
        });
    });
    describe('when there is data', () => {
        it('shows the panel', () => {
            const firstBarPanel = 'firstBarPanel';
            const secondBarPanel = 'secondBarPanel';
            const panelData = buildPanelData({
                data: {
                    series: [
                        toDataFrame({
                            target: firstBarPanel,
                            datapoints: [
                                [100, 1000],
                                [100, 200],
                            ],
                        }),
                    ],
                    timeRange: createTimeRange(),
                    state: LoadingState.Done,
                },
            });
            const { rerender } = render(React.createElement(BarGaugePanel, Object.assign({}, panelData)));
            expect(screen.queryByText(/100/)).toBeInTheDocument();
            expect(screen.queryByText(/firstbarpanel/i)).not.toBeInTheDocument();
            expect(screen.getByTestId(valueSelector)).toBeInTheDocument();
            rerender(React.createElement(BarGaugePanel, Object.assign({}, buildPanelData({
                data: {
                    series: [
                        toDataFrame({
                            target: firstBarPanel,
                            datapoints: [
                                [200, 1000],
                                [200, 300],
                            ],
                        }),
                        toDataFrame({
                            target: secondBarPanel,
                            datapoints: [
                                [300, 3000],
                                [300, 300],
                            ],
                        }),
                    ],
                    timeRange: createTimeRange(),
                    state: LoadingState.Done,
                },
            }))));
            expect(screen.queryByText(/firstbarpanel/i)).toBeInTheDocument();
            expect(screen.queryByText(/secondbarpanel/i)).toBeInTheDocument();
            expect(screen.queryByText(/200/)).toBeInTheDocument();
            expect(screen.queryByText(/300/)).toBeInTheDocument();
            expect(screen.getAllByTestId(valueSelector).length).toEqual(2);
        });
    });
});
function buildPanelData(overrideValues) {
    const timeRange = createTimeRange();
    const defaultValues = {
        id: Number(uniqueId()),
        data: {
            series: [],
            state: LoadingState.Done,
            timeRange,
        },
        options: {
            displayMode: BarGaugeDisplayMode.Lcd,
            reduceOptions: {
                calcs: ['mean'],
                values: false,
            },
            orientation: VizOrientation.Horizontal,
            showUnfilled: true,
            minVizHeight: 10,
            minVizWidth: 0,
            valueMode: BarGaugeValueMode.Color,
            namePlacement: BarGaugeNamePlacement.Auto,
        },
        transparent: false,
        timeRange,
        timeZone: 'utc',
        title: 'hello',
        fieldConfig: {
            defaults: {},
            overrides: [],
        },
        onFieldConfigChange: jest.fn(),
        onOptionsChange: jest.fn(),
        onChangeTimeRange: jest.fn(),
        replaceVariables: jest.fn(),
        renderCounter: 0,
        width: 552,
        height: 250,
        eventBus: {},
    };
    return Object.assign(Object.assign({}, defaultValues), overrideValues);
}
function createTimeRange() {
    return {
        from: dateMath.parse('now-6h') || dateTime(),
        to: dateMath.parse('now') || dateTime(),
        raw: { from: 'now-6h', to: 'now' },
    };
}
//# sourceMappingURL=BarGaugePanel.test.js.map