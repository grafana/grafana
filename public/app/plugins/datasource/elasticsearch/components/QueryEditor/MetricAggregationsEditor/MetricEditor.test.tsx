import { act, fireEvent, render, screen } from '@testing-library/react';
import React, { ReactNode, PropsWithChildren } from 'react';
import { from } from 'rxjs';

import { getDefaultTimeRange } from '@grafana/data';

import { ElasticDatasource } from '../../../datasource';
import { defaultBucketAgg, defaultMetricAgg } from '../../../queryDef';
import { ElasticsearchQuery } from '../../../types';
import { ElasticsearchProvider } from '../ElasticsearchQueryContext';

import { MetricEditor } from './MetricEditor';
import { Average, UniqueCount } from './aggregations';

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
    const setupTopMetricsScreen = (xpack: boolean) => {
      const query: ElasticsearchQuery = {
        refId: 'A',
        query: '',
        metrics: [defaultMetricAgg('1')],
        bucketAggs: [defaultBucketAgg('2')],
      };

      const getFields: ElasticDatasource['getFields'] = jest.fn(() => from([[]]));

      const esVersion = '7.7.0';

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

    it('Should include top metrics aggregation when X-Pack is enabled', () => {
      setupTopMetricsScreen(true);
      expect(screen.getByText('Top Metrics')).toBeInTheDocument();
    });

    it('Should NOT include top metrics aggregation where X-Pack is disabled', () => {
      setupTopMetricsScreen(false);
      expect(screen.queryByText('Top Metrics')).toBe(null);
    });
  });
});
