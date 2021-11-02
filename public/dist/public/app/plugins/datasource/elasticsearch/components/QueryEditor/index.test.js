import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryEditor } from '.';
var noop = function () { return void 0; };
describe('QueryEditor', function () {
    describe('Alias Field', function () {
        it('Should correctly render and trigger changes on blur', function () {
            var alias = '{{metric}}';
            var query = {
                refId: 'A',
                query: '',
                alias: alias,
                metrics: [
                    {
                        id: '1',
                        type: 'raw_data',
                    },
                ],
                bucketAggs: [],
            };
            var onChange = jest.fn();
            render(React.createElement(QueryEditor, { query: query, datasource: {}, onChange: onChange, onRunQuery: noop }));
            var aliasField = screen.getByLabelText('Alias');
            // The Query should have an alias field
            expect(aliasField).toBeInTheDocument();
            // its value should match the one in the query
            expect(aliasField.value).toBe(alias);
            // We change value and trigger a blur event to trigger an update
            var newAlias = 'new alias';
            fireEvent.change(aliasField, { target: { value: newAlias } });
            fireEvent.blur(aliasField);
            // the onChange handler should have been called correctly, and the resulting
            // query state should match what expected
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange.mock.calls[0][0].alias).toBe(newAlias);
        });
        it('Should be disabled if last bucket aggregation is not Date Histogram', function () {
            var query = {
                refId: 'A',
                query: '',
                metrics: [
                    {
                        id: '1',
                        type: 'avg',
                    },
                ],
                bucketAggs: [{ id: '2', type: 'terms' }],
            };
            render(React.createElement(QueryEditor, { query: query, datasource: {}, onChange: noop, onRunQuery: noop }));
            expect(screen.getByLabelText('Alias')).toBeDisabled();
        });
        it('Should be enabled if last bucket aggregation is Date Histogram', function () {
            var query = {
                refId: 'A',
                query: '',
                metrics: [
                    {
                        id: '1',
                        type: 'avg',
                    },
                ],
                bucketAggs: [{ id: '2', type: 'date_histogram' }],
            };
            render(React.createElement(QueryEditor, { query: query, datasource: {}, onChange: noop, onRunQuery: noop }));
            expect(screen.getByLabelText('Alias')).toBeEnabled();
        });
    });
    it('Should NOT show Bucket Aggregations Editor if query contains a "singleMetric" metric', function () {
        var query = {
            refId: 'A',
            query: '',
            metrics: [
                {
                    id: '1',
                    type: 'logs',
                },
            ],
            // Even if present, this shouldn't be shown in the UI
            bucketAggs: [{ id: '2', type: 'date_histogram' }],
        };
        render(React.createElement(QueryEditor, { query: query, datasource: {}, onChange: noop, onRunQuery: noop }));
        expect(screen.queryByLabelText('Group By')).not.toBeInTheDocument();
    });
    it('Should show Bucket Aggregations Editor if query does NOT contains a "singleMetric" metric', function () {
        var query = {
            refId: 'A',
            query: '',
            metrics: [
                {
                    id: '1',
                    type: 'avg',
                },
            ],
            bucketAggs: [{ id: '2', type: 'date_histogram' }],
        };
        render(React.createElement(QueryEditor, { query: query, datasource: {}, onChange: noop, onRunQuery: noop }));
        expect(screen.getByText('Group By')).toBeInTheDocument();
    });
});
//# sourceMappingURL=index.test.js.map