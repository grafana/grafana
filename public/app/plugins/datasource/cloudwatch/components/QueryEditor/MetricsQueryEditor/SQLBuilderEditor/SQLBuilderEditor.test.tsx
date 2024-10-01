import { render, screen, waitFor } from '@testing-library/react';

import { setupMockedDataSource } from '../../../../__mocks__/CloudWatchDataSource';
import { QueryEditorExpressionType, QueryEditorPropertyType } from '../../../../expressions';
import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType, SQLExpression } from '../../../../types';

import { SQLBuilderEditor } from './SQLBuilderEditor';

const { datasource } = setupMockedDataSource();

export const makeSQLQuery = (sql?: SQLExpression): CloudWatchMetricsQuery => ({
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

describe('Cloudwatch SQLBuilderEditor', () => {
  beforeEach(() => {
    datasource.resources.getNamespaces = jest.fn().mockResolvedValue([]);
    datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
    datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
    datasource.resources.getDimensionValues = jest.fn().mockResolvedValue([]);
  });

  const baseProps = {
    query: makeSQLQuery(),
    datasource,
    onChange: () => {},
  };

  it('Displays the namespace', async () => {
    const query = makeSQLQuery({
      from: {
        type: QueryEditorExpressionType.Property,
        property: {
          type: QueryEditorPropertyType.String,
          name: 'AWS/EC2',
        },
      },
    });

    render(<SQLBuilderEditor {...baseProps} query={query} />);
    await waitFor(() => expect(datasource.resources.getNamespaces).toHaveBeenCalled());

    expect(screen.getByText('AWS/EC2')).toBeInTheDocument();
    expect(screen.getByLabelText('With schema')).not.toBeChecked();
  });

  it('Displays withSchema namespace', async () => {
    const query = makeSQLQuery({
      from: {
        type: QueryEditorExpressionType.Function,
        name: 'SCHEMA',
        parameters: [
          {
            type: QueryEditorExpressionType.FunctionParameter,
            name: 'AWS/EC2',
          },
        ],
      },
    });

    render(<SQLBuilderEditor {...baseProps} query={query} />);
    await waitFor(() => expect(datasource.resources.getNamespaces).toHaveBeenCalled());

    expect(screen.getByText('AWS/EC2')).toBeInTheDocument();
    expect(screen.getByLabelText('With schema')).toBeChecked();
    expect(screen.getByText('Schema labels')).toBeInTheDocument();
  });

  it('Uses dimension filter when loading dimension keys if query includes InstanceID', async () => {
    const query = makeSQLQuery({
      from: {
        type: QueryEditorExpressionType.Function,
        name: 'SCHEMA',
        parameters: [
          {
            type: QueryEditorExpressionType.FunctionParameter,
            name: 'AWS/EC2',
          },
          {
            type: QueryEditorExpressionType.FunctionParameter,
            name: 'InstanceId',
          },
        ],
      },
    });

    render(<SQLBuilderEditor {...baseProps} query={query} />);
    await waitFor(() =>
      expect(datasource.resources.getDimensionKeys).toHaveBeenCalledWith(
        {
          namespace: 'AWS/EC2',
          region: query.region,
          dimensionFilters: { InstanceId: null },
          metricName: undefined,
        },
        false
      )
    );
    expect(screen.getByText('AWS/EC2')).toBeInTheDocument();
    expect(screen.getByLabelText('With schema')).toBeChecked();
    expect(screen.getByText('Schema labels')).toBeInTheDocument();
  });

  it('Displays the SELECT correctly', async () => {
    const query = makeSQLQuery({
      select: {
        type: QueryEditorExpressionType.Function,
        name: 'AVERAGE',
        parameters: [
          {
            type: QueryEditorExpressionType.FunctionParameter,
            name: 'CPUUtilization',
          },
        ],
      },
    });

    render(<SQLBuilderEditor {...baseProps} query={query} />);
    await waitFor(() => expect(datasource.resources.getNamespaces).toHaveBeenCalled());

    expect(screen.getByText('AVERAGE')).toBeInTheDocument();
    expect(screen.getByText('CPUUtilization')).toBeInTheDocument();
  });

  describe('ORDER BY', () => {
    it('should display it correctly when its specified', async () => {
      const query = makeSQLQuery({
        orderBy: {
          type: QueryEditorExpressionType.Function,
          name: 'AVG',
        },
      });

      render(<SQLBuilderEditor {...baseProps} query={query} />);
      await waitFor(() => expect(datasource.resources.getNamespaces).toHaveBeenCalled());

      expect(screen.getByText('AVG')).toBeInTheDocument();
      const directionElement = screen.getByLabelText('Direction');
      expect(directionElement).toBeInTheDocument();
      expect(directionElement).not.toBeDisabled();
    });

    it('should display it correctly when its not specified', async () => {
      const query = makeSQLQuery({});

      render(<SQLBuilderEditor {...baseProps} query={query} />);
      await waitFor(() => expect(datasource.resources.getNamespaces).toHaveBeenCalled());

      expect(screen.queryByText('AVG')).toBeNull();
      const directionElement = screen.getByLabelText('Direction');
      expect(directionElement).toBeInTheDocument();
      expect(directionElement).toBeDisabled();
    });
  });
});
