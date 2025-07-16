import { act, render, screen } from '@testing-library/react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { QueryEditorExpressionType, QueryEditorPropertyType } from '../../../../expressions';
import { setupMockedDataSource } from '../../../../mocks/CloudWatchDataSource';
import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType, SQLExpression } from '../../../../types';

import SQLBuilderSelectRow from './SQLBuilderSelectRow';

const { datasource } = setupMockedDataSource();

const makeSQLQuery = (sql?: SQLExpression): CloudWatchMetricsQuery => ({
  queryMode: 'Metrics',
  refId: '',
  id: '',
  region: 'us-east-1',
  namespace: 'ec2',
  dimensions: { somekey: 'somevalue' },
  metricQueryType: MetricQueryType.Insights,
  metricEditorMode: MetricEditorMode.Builder,
  sql: sql,
});

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

const onQueryChange = jest.fn();
const baseProps = {
  query,
  datasource,
  onQueryChange,
};

const namespaces = [
  { value: 'n1', label: 'n1', text: 'n1' },
  { value: 'n2', label: 'n2', text: 'n2' },
];
const metrics = [
  { value: 'm1', label: 'm1', text: 'm1' },
  { value: 'm2', label: 'm2', text: 'm2' },
];

describe('Cloudwatch SQLBuilderSelectRow', () => {
  beforeEach(() => {
    datasource.resources.getNamespaces = jest.fn().mockResolvedValue(namespaces);
    datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
    datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
    datasource.resources.getDimensionValues = jest.fn().mockResolvedValue([]);
    onQueryChange.mockReset();
  });

  it('Should not reset metricName when selecting a namespace if metric exist in new namespace', async () => {
    datasource.resources.getMetrics = jest.fn().mockResolvedValue(metrics);

    await act(async () => {
      render(<SQLBuilderSelectRow {...baseProps} />);
    });

    expect(screen.getByText('n1')).toBeInTheDocument();
    expect(screen.getByText('m1')).toBeInTheDocument();
    const namespaceSelect = screen.getByLabelText('Namespace');
    await selectOptionInTest(namespaceSelect, 'n2');

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

  it('Should reset metricName when selecting a namespace if metric does not exist in new namespace', async () => {
    datasource.resources.getMetrics = jest.fn().mockImplementation((namespace: string, region: string) => {
      let mockMetrics =
        namespace === 'n1' && region === baseProps.query.region
          ? metrics
          : [{ value: 'newNamespaceMetric', label: 'newNamespaceMetric', text: 'newNamespaceMetric' }];
      return Promise.resolve(mockMetrics);
    });

    await act(async () => {
      render(<SQLBuilderSelectRow {...baseProps} />);
    });

    expect(screen.getByText('n1')).toBeInTheDocument();
    expect(screen.getByText('m1')).toBeInTheDocument();
    const namespaceSelect = screen.getByLabelText('Namespace');
    await selectOptionInTest(namespaceSelect, 'n2');

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
