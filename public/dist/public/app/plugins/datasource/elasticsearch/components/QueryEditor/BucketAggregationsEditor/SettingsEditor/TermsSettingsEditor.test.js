import { screen } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';
import { describeMetric } from 'app/plugins/datasource/elasticsearch/utils';
import { renderWithESProvider } from '../../../../test-helpers/render';
import { TermsSettingsEditor } from './TermsSettingsEditor';
describe('Terms Settings Editor', () => {
    it('Pipeline aggregations should not be in "order by" options', () => {
        const termsAgg = {
            id: '1',
            type: 'terms',
        };
        const avg = { id: '2', type: 'avg', field: '@value' };
        const derivative = { id: '3', field: avg.id, type: 'derivative' };
        const topMetrics = { id: '4', type: 'top_metrics' };
        const query = {
            refId: 'A',
            query: '',
            bucketAggs: [termsAgg],
            metrics: [avg, derivative, topMetrics],
        };
        renderWithESProvider(React.createElement(TermsSettingsEditor, { bucketAgg: termsAgg }), { providerProps: { query } });
        const selectEl = screen.getByLabelText('Order By');
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