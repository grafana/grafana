import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

import { QueryEditorProps } from '@grafana/data';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchAnnotationQuery, CloudWatchJsonData, CloudWatchMetricsQuery, CloudWatchQuery } from '../types';

import { AnnotationQueryEditor } from './AnnotationQueryEditor';

const ds = setupMockedDataSource({
  variables: [],
});

const q: CloudWatchQuery = {
  queryMode: 'Annotations',
  region: 'us-east-2',
  namespace: '',
  period: '',
  metricName: '',
  dimensions: {},
  matchExact: true,
  statistic: '',
  refId: '',
  prefixMatching: false,
  actionPrefix: '',
  alarmNamePrefix: '',
};

ds.datasource.api.getRegions = jest.fn().mockResolvedValue([]);
ds.datasource.api.getNamespaces = jest.fn().mockResolvedValue([]);
ds.datasource.api.getMetrics = jest.fn().mockResolvedValue([]);
ds.datasource.api.getDimensionKeys = jest.fn().mockResolvedValue([]);
ds.datasource.getVariables = jest.fn().mockReturnValue([]);

const props: QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> = {
  datasource: ds.datasource,
  query: q,
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
};

describe('AnnotationQueryEditor', () => {
  it('should not display match exact switch', async () => {
    render(<AnnotationQueryEditor {...props} />);
    await waitFor(() => {
      expect(screen.queryByText('Match exact')).toBeNull();
    });
  });

  it('should return an error component in case CloudWatchQuery is not CloudWatchAnnotationQuery', async () => {
    ds.datasource.api.getDimensionValues = jest.fn().mockResolvedValue([[{ label: 'dimVal1', value: 'dimVal1' }]]);
    render(
      <AnnotationQueryEditor {...props} query={{ ...props.query, queryMode: 'Metrics' } as CloudWatchMetricsQuery} />
    );
    await waitFor(() => expect(screen.getByText('Invalid annotation query')).toBeInTheDocument());
  });

  it('should not display wildcard option in dimension value dropdown', async () => {
    ds.datasource.api.getDimensionValues = jest.fn().mockResolvedValue([[{ label: 'dimVal1', value: 'dimVal1' }]]);
    (props.query as CloudWatchAnnotationQuery).dimensions = { instanceId: 'instance-123' };
    render(<AnnotationQueryEditor {...props} />);
    const valueElement = screen.getByText('instance-123');
    expect(valueElement).toBeInTheDocument();
    expect(screen.queryByText('*')).toBeNull();
    valueElement.click();
    await waitFor(() => {
      expect(screen.queryByText('*')).toBeNull();
    });
  });

  it('should not display Accounts component', async () => {
    ds.datasource.api.getDimensionValues = jest.fn().mockResolvedValue([[{ label: 'dimVal1', value: 'dimVal1' }]]);
    (props.query as CloudWatchAnnotationQuery).dimensions = { instanceId: 'instance-123' };
    await waitFor(() => render(<AnnotationQueryEditor {...props} />));
    expect(await screen.queryByText('Account')).toBeNull();
  });
});
