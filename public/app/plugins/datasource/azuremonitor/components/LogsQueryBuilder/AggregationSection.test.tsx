import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  AzureQueryType,
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorReduceExpression,
  BuilderQueryEditorReduceParameterTypes,
} from '../../dataquery.gen';
import { AzureMonitorQuery } from '../../types/query';

import { AggregateSection } from './AggregationSection';

describe('AggregationSection', () => {
  const mockAllColumns = [
    { name: 'TimeGenerated', type: 'datetime' },
    { name: 'Level', type: 'string' },
    { name: 'Count', type: 'int' },
    { name: 'Duration', type: 'real' },
  ];

  const mockTemplateVariables = { label: '$variable', value: '$variable' };

  const createMockQuery = (reduce?: BuilderQueryEditorReduceExpression[]): AzureMonitorQuery => ({
    refId: 'A',
    queryType: AzureQueryType.LogAnalytics,
    azureLogAnalytics: {
      builderQuery: {
        from: {
          type: BuilderQueryEditorExpressionType.Property,
          property: { type: BuilderQueryEditorPropertyType.String, name: 'AppRequests' },
        },
        columns: {
          type: BuilderQueryEditorExpressionType.Property,
          columns: [],
        },
        reduce: {
          type: BuilderQueryEditorExpressionType.Reduce,
          expressions: reduce || [],
        },
        where: {
          type: BuilderQueryEditorExpressionType.And,
          expressions: [],
        },
        groupBy: {
          type: BuilderQueryEditorExpressionType.Group_by,
          expressions: [],
        },
      },
    },
  });

  const defaultProps = {
    query: createMockQuery(),
    allColumns: mockAllColumns,
    templateVariableOptions: mockTemplateVariables,
    buildAndUpdateQuery: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the aggregate section', () => {
    render(<AggregateSection {...defaultProps} />);
    expect(screen.getByTestId('aggregate-section')).toBeInTheDocument();
  });

  it('renders empty list when no aggregates exist', () => {
    render(<AggregateSection {...defaultProps} />);
    const addButton = screen.getByRole('button', { name: /add/i });
    expect(addButton).toBeInTheDocument();
  });

  it('renders existing aggregates', () => {
    const existingAggregates: BuilderQueryEditorReduceExpression[] = [
      {
        reduce: {
          name: 'sum',
          type: BuilderQueryEditorPropertyType.Function,
          parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
        },
        property: {
          name: 'Count',
          type: BuilderQueryEditorPropertyType.String,
        },
      },
      {
        reduce: {
          name: 'avg',
          type: BuilderQueryEditorPropertyType.Function,
          parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
        },
        property: {
          name: 'Duration',
          type: BuilderQueryEditorPropertyType.String,
        },
      },
    ];

    const queryWithAggregates = createMockQuery(existingAggregates);
    render(<AggregateSection {...defaultProps} query={queryWithAggregates} />);

    expect(screen.getAllByLabelText('Aggregate function')).toHaveLength(2);
  });

  it('calls buildAndUpdateQuery when aggregate is added', async () => {
    render(<AggregateSection {...defaultProps} />);

    const addButton = screen.getByRole('button', { name: /add/i });
    await userEvent.click(addButton);

    expect(defaultProps.buildAndUpdateQuery).toHaveBeenCalledWith({
      reduce: expect.arrayContaining([expect.objectContaining({})]),
    });
  });

  it('calls buildAndUpdateQuery when aggregate is deleted', async () => {
    const existingAggregates: BuilderQueryEditorReduceExpression[] = [
      {
        reduce: {
          name: 'sum',
          type: BuilderQueryEditorPropertyType.Function,
          parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
        },
        property: {
          name: 'Count',
          type: BuilderQueryEditorPropertyType.String,
        },
      },
    ];
    const avgAggregate = {
      reduce: {
        name: 'avg',
        type: BuilderQueryEditorPropertyType.Function,
        parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
      },
      property: {
        name: 'Duration',
        type: BuilderQueryEditorPropertyType.String,
      },
    };
    existingAggregates.push(avgAggregate);

    const queryWithAggregates = createMockQuery(existingAggregates);
    render(<AggregateSection {...defaultProps} query={queryWithAggregates} />);

    const deleteButton = (await screen.findAllByLabelText('Remove'))[0];
    await userEvent.click(deleteButton);

    expect(defaultProps.buildAndUpdateQuery).toHaveBeenCalledWith({
      reduce: [avgAggregate],
    });
    expect(screen.getAllByLabelText('Aggregate function')).toHaveLength(1);
  });

  it('provides numeric columns for numeric aggregate functions', async () => {
    const numericAggregate: BuilderQueryEditorReduceExpression[] = [
      {
        reduce: {
          name: 'sum',
          type: BuilderQueryEditorPropertyType.Function,
          parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
        },
      },
    ];

    const queryWithAggregate = createMockQuery(numericAggregate);
    render(<AggregateSection {...defaultProps} query={queryWithAggregate} />);

    const columnSelect = screen.getByLabelText('Column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('Count')).toBeInTheDocument();
    expect(await screen.getByText('Duration')).toBeInTheDocument();

    expect(screen.queryByText('Level')).not.toBeInTheDocument();
  });

  it('provides all columns for generic aggregate functions', async () => {
    const genericAggregate: BuilderQueryEditorReduceExpression[] = [
      {
        reduce: {
          name: 'min',
          type: BuilderQueryEditorPropertyType.Function,
          parameterType: BuilderQueryEditorReduceParameterTypes.Generic,
        },
      },
    ];

    const queryWithAggregate = createMockQuery(genericAggregate);
    render(<AggregateSection {...defaultProps} query={queryWithAggregate} />);

    const columnSelect = screen.getByLabelText('Column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('TimeGenerated')).toBeInTheDocument();
    expect(await screen.getByText('Level')).toBeInTheDocument();
    expect(await screen.getByText('Count')).toBeInTheDocument();
    expect(await screen.getByText('Duration')).toBeInTheDocument();
  });

  it('resets aggregates when table changes', () => {
    const existingAggregates: BuilderQueryEditorReduceExpression[] = [
      {
        reduce: {
          name: 'sum',
          type: BuilderQueryEditorPropertyType.Function,
          parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
        },
        property: {
          name: 'Count',
          type: BuilderQueryEditorPropertyType.String,
        },
      },
    ];

    const queryWithAggregates = createMockQuery(existingAggregates);
    const { rerender } = render(<AggregateSection {...defaultProps} query={queryWithAggregates} />);

    const newQuery = createMockQuery(existingAggregates);
    newQuery.azureLogAnalytics!.builderQuery!.from!.property.name = 'AppEvents';

    rerender(<AggregateSection {...defaultProps} query={newQuery} />);

    const addButton = screen.getByRole('button', { name: /add/i });
    expect(addButton).toBeInTheDocument();
  });

  it('uses selected columns when available', async () => {
    const aggregate: BuilderQueryEditorReduceExpression[] = [
      {
        reduce: {
          name: 'sum',
          type: BuilderQueryEditorPropertyType.Function,
          parameterType: BuilderQueryEditorReduceParameterTypes.Generic,
        },
      },
    ];

    const query = createMockQuery(aggregate);
    query.azureLogAnalytics!.builderQuery = {
      ...query.azureLogAnalytics!.builderQuery,
      columns: {
        columns: ['TimeGenerated', 'Level'],
        type: BuilderQueryEditorExpressionType.Property,
      },
    };

    render(<AggregateSection {...defaultProps} query={query} />);

    const columnSelect = screen.getByLabelText('Column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('TimeGenerated')).toBeInTheDocument();
    expect(await screen.getByText('Level')).toBeInTheDocument();

    expect(screen.queryByText('Count')).not.toBeInTheDocument();
    expect(screen.queryByText('Duration')).not.toBeInTheDocument();
  });

  it('falls back to all columns when no columns selected', async () => {
    const aggregate: BuilderQueryEditorReduceExpression[] = [
      {
        reduce: {
          name: 'sum',
          type: BuilderQueryEditorPropertyType.Function,
          parameterType: BuilderQueryEditorReduceParameterTypes.Generic,
        },
      },
    ];

    const query = createMockQuery(aggregate);
    query.azureLogAnalytics!.builderQuery = {
      ...query.azureLogAnalytics!.builderQuery,
      columns: {
        columns: [],
        type: BuilderQueryEditorExpressionType.Property,
      },
    };

    render(<AggregateSection {...defaultProps} query={query} />);

    const columnSelect = screen.getByLabelText('Column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('TimeGenerated')).toBeInTheDocument();
    expect(await screen.getByText('Level')).toBeInTheDocument();
    expect(await screen.getByText('Count')).toBeInTheDocument();
    expect(await screen.getByText('Duration')).toBeInTheDocument();
  });
});
