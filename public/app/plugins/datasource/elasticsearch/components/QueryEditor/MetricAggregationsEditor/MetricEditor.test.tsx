import { act, fireEvent, render, screen } from '@testing-library/react';
import { ElasticsearchProvider } from '../ElasticsearchQueryContext';
import { MetricEditor, getTypeOptions } from './MetricEditor';
import React, { ReactNode } from 'react';
import { ElasticDatasource } from '../../../datasource';
import { getDefaultTimeRange } from '@grafana/data';
import { ElasticsearchQuery } from '../../../types';
import { Average, MetricAggregation, UniqueCount } from './aggregations';
import { defaultBucketAgg } from '../../../query_def';
import { from } from 'rxjs';

describe('Metric Editor', () => {
  describe('Component', () => {
    it('Should display a "None" option for "field" if the metric supports inline script', async () => {
      const avg: Average = {
        id: '1',
        type: 'avg',
      };

      const query: ElasticsearchQuery = {
        refId: 'A',
        query: '',
        metrics: [avg],
        bucketAggs: [defaultBucketAgg('2')],
      };

      const getFields: ElasticDatasource['getFields'] = jest.fn(() => from([[]]));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ElasticsearchProvider
          datasource={{ getFields } as ElasticDatasource}
          query={query}
          range={getDefaultTimeRange()}
          onChange={() => {}}
          onRunQuery={() => {}}
        >
          {children}
        </ElasticsearchProvider>
      );

      render(<MetricEditor value={avg} />, { wrapper });

      act(() => {
        fireEvent.click(screen.getByText('Select Field'));
      });

      expect(await screen.findByText('None')).toBeInTheDocument();
    });

    it('Should not display a "None" option for "field" if the metric does not support inline script', async () => {
      const avg: UniqueCount = {
        id: '1',
        type: 'cardinality',
      };

      const query: ElasticsearchQuery = {
        refId: 'A',
        query: '',
        metrics: [avg],
        bucketAggs: [defaultBucketAgg('2')],
      };

      const getFields: ElasticDatasource['getFields'] = jest.fn(() => from([[]]));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ElasticsearchProvider
          datasource={{ getFields } as ElasticDatasource}
          query={query}
          range={getDefaultTimeRange()}
          onChange={() => {}}
          onRunQuery={() => {}}
        >
          {children}
        </ElasticsearchProvider>
      );

      render(<MetricEditor value={avg} />, { wrapper });

      act(() => {
        fireEvent.click(screen.getByText('Select Field'));
      });

      expect(await screen.findByText('No options found')).toBeInTheDocument();
      expect(screen.queryByText('None')).not.toBeInTheDocument();
    });
  });

  describe('getTypeOptions()', () => {
    it('should return top_metrics when xpack is enabled', () => {
      const previousMetrics: MetricAggregation[] = [
        {
          id: '1',
          type: 'avg',
          field: 'system.cpu.total.pct',
        },
      ];
      expect(getTypeOptions(previousMetrics, 77, false).some((option) => option.value === 'top_metrics')).toBe(false);
      expect(getTypeOptions(previousMetrics, 77, true).some((option) => option.value === 'top_metrics')).toBe(true);
    });
    it('should return top_metrics only when esVersion is equal or greater than 77', () => {
      const previousMetrics: MetricAggregation[] = [
        {
          id: '1',
          type: 'avg',
          field: 'system.cpu.total.pct',
        },
      ];
      expect(getTypeOptions(previousMetrics, 70, true).some((option) => option.value === 'top_metrics')).toBe(false);
      expect(getTypeOptions(previousMetrics, 77, true).some((option) => option.value === 'top_metrics')).toBe(true);
    });
  });
});
