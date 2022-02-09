import { act, fireEvent, render, screen } from '@testing-library/react';
import { ElasticsearchProvider } from '../ElasticsearchQueryContext';
import { MetricEditor } from './MetricEditor';
import React, { ReactNode, PropsWithChildren } from 'react';
import { ElasticDatasource } from '../../../datasource';
import { getDefaultTimeRange } from '@grafana/data';
import { ElasticsearchQuery } from '../../../types';
import { Average, UniqueCount } from './aggregations';
import { defaultBucketAgg, defaultMetricAgg } from '../../../query_def';
import { from } from 'rxjs';

describe('Metric Editor', () => {
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

    const wrapper = ({ children }: PropsWithChildren<{}>) => (
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

    const wrapper = ({ children }: PropsWithChildren<{}>) => (
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

  describe('Top Metrics Aggregation', () => {
    const setupTopMetricsScreen = (esVersion: string, xpack: boolean) => {
      const query: ElasticsearchQuery = {
        refId: 'A',
        query: '',
        metrics: [defaultMetricAgg('1')],
        bucketAggs: [defaultBucketAgg('2')],
      };

      const getFields: ElasticDatasource['getFields'] = jest.fn(() => from([[]]));

      const wrapper = ({ children }: { children?: ReactNode }) => (
        <ElasticsearchProvider
          datasource={{ getFields, esVersion, xpack } as ElasticDatasource}
          query={query}
          range={getDefaultTimeRange()}
          onChange={() => {}}
          onRunQuery={() => {}}
        >
          {children}
        </ElasticsearchProvider>
      );

      render(<MetricEditor value={defaultMetricAgg('1')} />, { wrapper });

      act(() => {
        fireEvent.click(screen.getByText('Count'));
      });
    };

    it('Should include top metrics aggregation when esVersion is 77 and X-Pack is enabled', () => {
      setupTopMetricsScreen('7.7.0', true);
      expect(screen.getByText('Top Metrics')).toBeInTheDocument();
    });

    it('Should NOT include top metrics aggregation where esVersion is 77 and X-Pack is disabled', () => {
      setupTopMetricsScreen('7.7.0', false);
      expect(screen.queryByText('Top Metrics')).toBe(null);
    });

    it('Should NOT include top metrics aggregation when esVersion is 70 and X-Pack is enabled', () => {
      setupTopMetricsScreen('7.0.0', true);
      expect(screen.queryByText('Top Metrics')).toBe(null);
    });
  });
});
