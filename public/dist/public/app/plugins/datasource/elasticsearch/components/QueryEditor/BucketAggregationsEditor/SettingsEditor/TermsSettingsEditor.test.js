import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithESProvider } from '../../../../test-helpers/render';
import { TermsSettingsEditor } from './TermsSettingsEditor';
import selectEvent from 'react-select-event';
import { describeMetric } from 'app/plugins/datasource/elasticsearch/utils';
describe('Terms Settings Editor', function () {
    it('Pipeline aggregations should not be in "order by" options', function () {
        var termsAgg = {
            id: '1',
            type: 'terms',
        };
        var avg = { id: '2', type: 'avg', field: '@value' };
        var derivative = { id: '3', field: avg.id, type: 'derivative' };
        var topMetrics = { id: '4', type: 'top_metrics' };
        var query = {
            refId: 'A',
            query: '',
            bucketAggs: [termsAgg],
            metrics: [avg, derivative, topMetrics],
        };
        renderWithESProvider(React.createElement(TermsSettingsEditor, { bucketAgg: termsAgg }), { providerProps: { query: query } });
        var selectEl = screen.getByLabelText('Order By');
        expect(selectEl).toBeInTheDocument();
        selectEvent.openMenu(selectEl);
        // Derivative is a pipeline aggregation, it shouldn't be present in the order by options
        expect(screen.queryByText(describeMetric(derivative))).not.toBeInTheDocument();
        // TopMetrics cannot be used as order by option
        expect(screen.queryByText(describeMetric(topMetrics))).not.toBeInTheDocument();
        // All other metric aggregations can be used in order by
        expect(screen.getByText(describeMetric(avg))).toBeInTheDocument();
    });
});
//# sourceMappingURL=TermsSettingsEditor.test.js.map