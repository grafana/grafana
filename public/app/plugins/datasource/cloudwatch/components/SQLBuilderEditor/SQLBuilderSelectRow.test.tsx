import React from 'react';
import SQLBuilderSelectRow from './SQLBuilderSelectRow';
import { act, render, screen } from '@testing-library/react';
import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType, SQLExpression } from '../../types';
import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import { QueryEditorExpressionType, QueryEditorPropertyType } from '../../expressions';
import { selectOptionInTest } from '@grafana/ui';

const { datasource } = setupMockedDataSource();
datasource.getDimensionKeys = jest.fn().mockResolvedValue([]);
datasource.getDimensionValues = jest.fn().mockResolvedValue([]);
datasource.getNamespaces = jest.fn().mockResolvedValue([]);
datasource.getMetrics = jest.fn().mockResolvedValue([]);

const makeSQLQuery = (sql?: SQLExpression): CloudWatchMetricsQuery => ({
  queryMode: 'Metrics',
  refId: '',
  id: '',
  region: 'us-east-1',
  namespace: 'ec2',
  dimensions: { somekey: 'somevalue' },
  metricQueryType: MetricQueryType.Query,
  metricEditorMode: MetricEditorMode.Builder,
  sql: sql,
});

describe('Cloudwatch SQLBuilderSelectRow', () => {
  const query = makeSQLQuery({
    select: {
      type: QueryEditorExpressionType.Function,
      name: 'AVERAGE',
      parameters: [
        {
          type: QueryEditorExpressionType.FunctionParameter,
          name: 'm1',
        },
      ],
    },
    from: {
      type: QueryEditorExpressionType.Property,
      property: {
        type: QueryEditorPropertyType.String,
        name: 'n1',
      },
    },
  });

  const baseProps = {
    query,
    datasource,
    onQueryChange: () => {},
  };

  const namespaces = [
    { value: 'n1', label: 'n1', text: 'n1' },
    { value: 'n2', label: 'n2', text: 'n2' },
  ];
  const metrics = [
    { value: 'm1', label: 'm1', text: 'm1' },
    { value: 'm2', label: 'm2', text: 'm2' },
  ];

  beforeEach(() => {
    datasource.getNamespaces = jest.fn().mockResolvedValue(namespaces);
    datasource.getMetrics = jest.fn().mockResolvedValue([]);
  });

  it('Selecting a namespace should not reset metricName if it exist in new namespace', async () => {
    datasource.getMetrics = jest.fn().mockResolvedValue(metrics);
    const onQueryChange = jest.fn();

    await act(async () => {
      render(<SQLBuilderSelectRow {...baseProps} query={query} onQueryChange={onQueryChange} />);
    });

    expect(screen.getByText('n1')).toBeInTheDocument();
    expect(screen.getByText('m1')).toBeInTheDocument();

    const namespaceSelect = screen.getByLabelText('Namespace');

    await act(async () => {
      await selectOptionInTest(namespaceSelect, 'n2');
    });

    const expectedQuery = makeSQLQuery({
      select: {
        type: QueryEditorExpressionType.Function,
        name: 'AVERAGE',
        parameters: [
          {
            type: QueryEditorExpressionType.FunctionParameter,
            name: 'm1',
          },
        ],
      },
      from: {
        type: QueryEditorExpressionType.Property,
        property: {
          type: QueryEditorPropertyType.String,
          name: 'n2',
        },
      },
    });
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange.mock.calls).toEqual([[{ ...expectedQuery, namespace: 'n2' }]]);
  });

  it('Selecting a namespace should reset metricName if it does not exist in new namespace', async () => {
    datasource.getMetrics = jest.fn().mockImplementation((namespace: string, region: string) => {
      let mockMetrics =
        namespace === 'n1' && region === baseProps.query.region
          ? metrics
          : [{ value: 'oldNamespaceMetric', label: 'oldNamespaceMetric', text: 'oldNamespaceMetric' }];
      return Promise.resolve(mockMetrics);
    });
    const onQueryChange = jest.fn();

    await act(async () => {
      render(<SQLBuilderSelectRow {...baseProps} query={query} onQueryChange={onQueryChange} />);
    });

    expect(screen.getByText('n1')).toBeInTheDocument();
    expect(screen.getByText('m1')).toBeInTheDocument();

    const namespaceSelect = screen.getByLabelText('Namespace');

    await act(async () => {
      await selectOptionInTest(namespaceSelect, 'n2');
    });

    const expectedQuery = makeSQLQuery({
      select: {
        type: QueryEditorExpressionType.Function,
        name: 'AVERAGE',
      },
      from: {
        type: QueryEditorExpressionType.Property,
        property: {
          type: QueryEditorPropertyType.String,
          name: 'n2',
        },
      },
    });
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange.mock.calls).toEqual([[{ ...expectedQuery, namespace: 'n2' }]]);
  });
});
