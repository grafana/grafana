import { screen } from '@testing-library/react';
import { ElasticsearchQuery } from '../../../../types';
import React from 'react';
import { renderWithESProvider } from '../../../../test-helpers/render';
import { Average, Derivative, TopMetrics } from '../../MetricAggregationsEditor/aggregations';
import { Terms } from '../aggregations';
import { TermsSettingsEditor } from './TermsSettingsEditor';
import selectEvent from 'react-select-event';
import { describeMetric } from 'app/plugins/datasource/elasticsearch/utils';

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
