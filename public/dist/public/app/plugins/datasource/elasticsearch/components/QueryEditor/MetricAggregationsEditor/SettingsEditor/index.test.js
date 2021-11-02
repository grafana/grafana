import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsEditor } from '.';
import { ElasticsearchProvider } from '../../ElasticsearchQueryContext';
import { getDefaultTimeRange } from '@grafana/data';
describe('Settings Editor', function () {
    describe('Raw Data', function () {
        it('Should correctly render the settings editor and trigger correct state changes', function () {
            var metricId = '1';
            var initialSize = '500';
            var query = {
                refId: 'A',
                query: '',
                metrics: [
                    {
                        id: metricId,
                        type: 'raw_data',
                        settings: {
                            size: initialSize,
                        },
                    },
                ],
                bucketAggs: [],
            };
            var onChange = jest.fn();
            var rerender = render(React.createElement(ElasticsearchProvider, { query: query, datasource: {}, onChange: onChange, onRunQuery: function () { }, range: getDefaultTimeRange() },
                React.createElement(SettingsEditor, { metric: query.metrics[0], previousMetrics: [] }))).rerender;
            var settingsButtonEl = screen.getByRole('button', {
                name: /Size: \d+$/i,
            });
            // The metric row should have a settings button
            expect(settingsButtonEl).toBeInTheDocument();
            expect(settingsButtonEl.textContent).toBe("Size: " + initialSize);
            // Open the settings editor
            fireEvent.click(settingsButtonEl);
            // The settings editor should have a Size input
            var sizeInputEl = screen.getByLabelText('Size');
            expect(sizeInputEl).toBeInTheDocument();
            // We change value and trigger a blur event to trigger an update
            var newSizeValue = '23';
            fireEvent.change(sizeInputEl, { target: { value: newSizeValue } });
            fireEvent.blur(sizeInputEl);
            // the onChange handler should have been called correctly, and the resulting
            // query state should match what expected
            expect(onChange).toHaveBeenCalledTimes(1);
            rerender(React.createElement(ElasticsearchProvider, { query: onChange.mock.calls[0][0], datasource: {}, onChange: onChange, onRunQuery: function () { }, range: getDefaultTimeRange() },
                React.createElement(SettingsEditor, { metric: onChange.mock.calls[0][0].metrics[0], previousMetrics: [] })));
            settingsButtonEl = screen.getByRole('button', {
                name: /Size: \d+$/i,
            });
            expect(settingsButtonEl).toBeInTheDocument();
            expect(settingsButtonEl.textContent).toBe("Size: " + newSizeValue);
        });
    });
    describe('Rate aggregation', function () {
        it('should render correct settings', function () {
            var metricId = '1';
            var query = {
                refId: 'A',
                query: '',
                metrics: [
                    {
                        id: metricId,
                        type: 'rate',
                        settings: {},
                    },
                ],
                bucketAggs: [],
            };
            var onChange = jest.fn();
            render(React.createElement(ElasticsearchProvider, { query: query, datasource: {}, onChange: onChange, onRunQuery: function () { }, range: getDefaultTimeRange() },
                React.createElement(SettingsEditor, { metric: query.metrics[0], previousMetrics: [] })));
            var settingsButtonEl = screen.getByRole('button');
            fireEvent.click(settingsButtonEl);
            var unitSelectElement = screen.getByTestId('unit-select');
            var modeSelectElement = screen.getByTestId('mode-select');
            expect(unitSelectElement).toBeInTheDocument();
            expect(modeSelectElement).toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=index.test.js.map