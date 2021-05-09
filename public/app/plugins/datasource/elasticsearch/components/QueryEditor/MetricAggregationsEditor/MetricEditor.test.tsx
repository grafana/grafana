import { act, fireEvent, render, screen } from '@testing-library/react';
import { ElasticsearchProvider } from '../ElasticsearchQueryContext';
import { MetricEditor } from './MetricEditor';
import React, { PropsWithChildren } from 'react';
import { ElasticDatasource } from '../../../datasource';
import { getDefaultTimeRange } from '@grafana/data';
import { ElasticsearchQuery } from '../../../types';
import { Average, UniqueCount } from './aggregations';
import { defaultBucketAgg } from '../../../query_def';
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
});
