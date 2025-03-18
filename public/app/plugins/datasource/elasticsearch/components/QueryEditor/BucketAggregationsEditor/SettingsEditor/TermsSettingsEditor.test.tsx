import { screen } from '@testing-library/react';
import selectEvent from 'react-select-event';

import { renderWithESProvider } from '../../../../test-helpers/render';
import { ElasticsearchQuery, Terms, Average, Derivative, TopMetrics } from '../../../../types';
import { describeMetric } from '../../../../utils';

import { TermsSettingsEditor } from './TermsSettingsEditor';

describe('Terms Settings Editor', () => {
  it('Pipeline aggregations should not be in "order by" options', () => {
    const termsAgg: Terms = {
      id: '1',
      type: 'terms',
    };
    const avg: Average = { id: '2', type: 'avg', field: '@value' };
    const derivative: Derivative = { id: '3', field: avg.id, type: 'derivative' };
    const topMetrics: TopMetrics = { id: '4', type: 'top_metrics' };
    const query: ElasticsearchQuery = {
      refId: 'A',
      query: '',
      bucketAggs: [termsAgg],
      metrics: [avg, derivative, topMetrics],
    };

    renderWithESProvider(<TermsSettingsEditor bucketAgg={termsAgg} />, { providerProps: { query } });

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
