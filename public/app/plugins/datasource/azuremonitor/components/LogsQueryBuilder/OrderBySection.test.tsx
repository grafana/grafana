import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  AzureQueryType,
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorOrderByExpression,
  BuilderQueryEditorOrderByOptions,
  BuilderQueryEditorPropertyType,
} from '../../dataquery.gen';
import { AzureMonitorQuery } from '../../types/query';

import { OrderBySection } from './OrderBySection';

describe('OrderBySection', () => {
  const mockAllColumns = [
    { name: 'TimeGenerated', type: 'datetime' },
    { name: 'Level', type: 'string' },
    { name: 'Count', type: 'int' },
    { name: 'Duration', type: 'real' },
  ];

  const createMockQuery = (orderBy?: BuilderQueryEditorOrderByExpression[]): AzureMonitorQuery => ({
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
          columns: ['TimeGenerated', 'Level', 'Count'],
        },
        orderBy: {
          type: BuilderQueryEditorExpressionType.Order_by,
          expressions: orderBy || [],
        },
        reduce: {
          type: BuilderQueryEditorExpressionType.Reduce,
          expressions: [],
        },
        groupBy: {
          type: BuilderQueryEditorExpressionType.Group_by,
          expressions: [],
        },
        where: {
          type: BuilderQueryEditorExpressionType.And,
          expressions: [],
        },
      },
    },
  });

  const defaultProps = {
    query: createMockQuery(),
    allColumns: mockAllColumns,
    buildAndUpdateQuery: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the order by section', () => {
    render(<OrderBySection {...defaultProps} />);
    expect(screen.getByText('Order By')).toBeInTheDocument();
  });

  it('renders add button when no order by exists', () => {
    render(<OrderBySection {...defaultProps} />);
    const addButton = screen.getByLabelText('Add order by');
    expect(addButton).toBeInTheDocument();
  });

  it('renders existing order by expressions', () => {
    const existingOrderBy: BuilderQueryEditorOrderByExpression[] = [
      {
        property: { name: 'TimeGenerated', type: BuilderQueryEditorPropertyType.String },
        order: BuilderQueryEditorOrderByOptions.Desc,
        type: BuilderQueryEditorExpressionType.Order_by,
      },
      {
        property: { name: 'Level', type: BuilderQueryEditorPropertyType.String },
        order: BuilderQueryEditorOrderByOptions.Asc,
        type: BuilderQueryEditorExpressionType.Order_by,
      },
    ];

    const queryWithOrderBy = createMockQuery(existingOrderBy);
    render(<OrderBySection {...defaultProps} query={queryWithOrderBy} />);

    expect(screen.getAllByLabelText('Order by column')).toHaveLength(2);
    expect(screen.getAllByLabelText('Order Direction')).toHaveLength(2);
    expect(screen.getByText('TimeGenerated')).toBeInTheDocument();
    expect(screen.getByText('Level')).toBeInTheDocument();
  });

  it('calls buildAndUpdateQuery when order by is added', async () => {
    render(<OrderBySection {...defaultProps} />);

    const addButton = screen.getByLabelText('Add order by');
    await userEvent.click(addButton);

    expect(defaultProps.buildAndUpdateQuery).toHaveBeenCalledWith({
      orderBy: expect.arrayContaining([
        expect.objectContaining({
          property: expect.objectContaining({ name: '' }),
          order: BuilderQueryEditorOrderByOptions.Asc,
        }),
      ]),
    });
  });

  it('calls buildAndUpdateQuery when column is changed', async () => {
    const existingOrderBy: BuilderQueryEditorOrderByExpression[] = [
      {
        property: { name: 'TimeGenerated', type: BuilderQueryEditorPropertyType.String },
        order: BuilderQueryEditorOrderByOptions.Desc,
        type: BuilderQueryEditorExpressionType.Order_by,
      },
    ];

    const queryWithOrderBy = createMockQuery(existingOrderBy);
    render(<OrderBySection {...defaultProps} query={queryWithOrderBy} />);

    const columnSelect = screen.getByLabelText('Order by column');
    await userEvent.click(columnSelect);

    const levelOption = await screen.getByText('Level');
    await userEvent.click(levelOption);

    expect(defaultProps.buildAndUpdateQuery).toHaveBeenCalledWith({
      orderBy: expect.arrayContaining([
        expect.objectContaining({
          property: expect.objectContaining({ name: 'Level' }),
        }),
      ]),
    });
  });

  it('calls buildAndUpdateQuery when order direction is changed', async () => {
    const existingOrderBy: BuilderQueryEditorOrderByExpression[] = [
      {
        property: { name: 'TimeGenerated', type: BuilderQueryEditorPropertyType.String },
        order: BuilderQueryEditorOrderByOptions.Asc,
        type: BuilderQueryEditorExpressionType.Order_by,
      },
    ];

    const queryWithOrderBy = createMockQuery(existingOrderBy);
    render(<OrderBySection {...defaultProps} query={queryWithOrderBy} />);

    const orderSelect = screen.getByLabelText('Order Direction');
    await userEvent.click(orderSelect);

    const descOption = await screen.getByText('Descending');
    await userEvent.click(descOption);

    expect(defaultProps.buildAndUpdateQuery).toHaveBeenCalledWith({
      orderBy: expect.arrayContaining([
        expect.objectContaining({
          order: BuilderQueryEditorOrderByOptions.Desc,
        }),
      ]),
    });
  });

  it('calls buildAndUpdateQuery when order by is deleted', async () => {
    const existingOrderBy: BuilderQueryEditorOrderByExpression[] = [
      {
        property: { name: 'TimeGenerated', type: BuilderQueryEditorPropertyType.String },
        order: BuilderQueryEditorOrderByOptions.Desc,
        type: BuilderQueryEditorExpressionType.Order_by,
      },
      {
        property: { name: 'Level', type: BuilderQueryEditorPropertyType.String },
        order: BuilderQueryEditorOrderByOptions.Asc,
        type: BuilderQueryEditorExpressionType.Order_by,
      },
    ];

    const queryWithOrderBy = createMockQuery(existingOrderBy);
    render(<OrderBySection {...defaultProps} query={queryWithOrderBy} />);

    const removeButtons = screen.getAllByLabelText('Remove order by');
    await userEvent.click(removeButtons[0]);

    expect(defaultProps.buildAndUpdateQuery).toHaveBeenCalledWith({
      orderBy: [
        expect.objectContaining({
          property: expect.objectContaining({ name: 'Level' }),
        }),
      ],
    });
  });

  it('uses group by columns when available', async () => {
    const query = createMockQuery();
    query.azureLogAnalytics!.builderQuery!.groupBy = {
      type: BuilderQueryEditorExpressionType.Group_by,
      expressions: [
        {
          property: { name: 'Level', type: BuilderQueryEditorPropertyType.String },
          type: BuilderQueryEditorExpressionType.Group_by,
        },
      ],
    };

    render(<OrderBySection {...defaultProps} query={query} />);

    const addButton = screen.getByLabelText('Add order by');
    await userEvent.click(addButton);

    const columnSelect = screen.getByLabelText('Order by column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('Level')).toBeInTheDocument();
  });

  it('uses aggregate columns when available', async () => {
    const query = createMockQuery();
    query.azureLogAnalytics!.builderQuery!.reduce = {
      type: BuilderQueryEditorExpressionType.Reduce,
      expressions: [
        {
          reduce: {
            name: 'sum',
            type: BuilderQueryEditorPropertyType.Function,
          },
          property: { name: 'Count', type: BuilderQueryEditorPropertyType.String },
        },
      ],
    };

    render(<OrderBySection {...defaultProps} query={query} />);

    const addButton = screen.getByLabelText('Add order by');
    await userEvent.click(addButton);

    const columnSelect = screen.getByLabelText('Order by column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('Count')).toBeInTheDocument();
  });

  it('uses both group by and aggregate columns when available', async () => {
    const query = createMockQuery();
    query.azureLogAnalytics!.builderQuery!.groupBy = {
      type: BuilderQueryEditorExpressionType.Group_by,
      expressions: [
        {
          property: { name: 'Level', type: BuilderQueryEditorPropertyType.String },
          type: BuilderQueryEditorExpressionType.Group_by,
        },
      ],
    };
    query.azureLogAnalytics!.builderQuery!.reduce = {
      type: BuilderQueryEditorExpressionType.Reduce,
      expressions: [
        {
          reduce: {
            name: 'sum',
            type: BuilderQueryEditorPropertyType.Function,
          },
          property: { name: 'Count', type: BuilderQueryEditorPropertyType.String },
        },
      ],
    };

    render(<OrderBySection {...defaultProps} query={query} />);

    const addButton = screen.getByLabelText('Add order by');
    await userEvent.click(addButton);

    const columnSelect = screen.getByLabelText('Order by column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('Level')).toBeInTheDocument();
    expect(await screen.getByText('Count')).toBeInTheDocument();
  });

  it('does not duplicate available columns', async () => {
    const query = createMockQuery();
    query.azureLogAnalytics!.builderQuery!.groupBy = {
      type: BuilderQueryEditorExpressionType.Group_by,
      expressions: [
        {
          property: { name: 'Level', type: BuilderQueryEditorPropertyType.String },
          type: BuilderQueryEditorExpressionType.Group_by,
        },
      ],
    };
    query.azureLogAnalytics!.builderQuery!.reduce = {
      type: BuilderQueryEditorExpressionType.Reduce,
      expressions: [
        {
          reduce: {
            name: 'sum',
            type: BuilderQueryEditorPropertyType.Function,
          },
          property: { name: 'Level', type: BuilderQueryEditorPropertyType.String },
        },
      ],
    };

    render(<OrderBySection {...defaultProps} query={query} />);

    const addButton = screen.getByLabelText('Add order by');
    await userEvent.click(addButton);

    const columnSelect = screen.getByLabelText('Order by column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('Level')).toBeInTheDocument();
  });

  it('uses selected columns when no group by or aggregates', async () => {
    const query = createMockQuery();
    query.azureLogAnalytics!.builderQuery!.columns!.columns = ['TimeGenerated', 'Level'];

    render(<OrderBySection {...defaultProps} query={query} />);

    const addButton = screen.getByLabelText('Add order by');
    await userEvent.click(addButton);

    const columnSelect = screen.getByLabelText('Order by column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('TimeGenerated')).toBeInTheDocument();
    expect(await screen.getByText('Level')).toBeInTheDocument();
  });

  it('falls back to all columns when no other columns available', async () => {
    const query = createMockQuery();
    query.azureLogAnalytics!.builderQuery!.columns!.columns = [];

    render(<OrderBySection {...defaultProps} query={query} />);

    const addButton = screen.getByLabelText('Add order by');
    await userEvent.click(addButton);

    const columnSelect = screen.getByLabelText('Order by column');
    await userEvent.click(columnSelect);

    expect(await screen.getByText('TimeGenerated')).toBeInTheDocument();
    expect(await screen.getByText('Level')).toBeInTheDocument();
    expect(await screen.getByText('Count')).toBeInTheDocument();
    expect(await screen.getByText('Duration')).toBeInTheDocument();
  });

  it('resets order by when table changes', () => {
    const existingOrderBy: BuilderQueryEditorOrderByExpression[] = [
      {
        property: { name: 'TimeGenerated', type: BuilderQueryEditorPropertyType.String },
        order: BuilderQueryEditorOrderByOptions.Desc,
        type: BuilderQueryEditorExpressionType.Order_by,
      },
    ];

    const queryWithOrderBy = createMockQuery(existingOrderBy);
    const { rerender } = render(<OrderBySection {...defaultProps} query={queryWithOrderBy} />);

    const newQuery = createMockQuery(existingOrderBy);
    newQuery.azureLogAnalytics!.builderQuery!.from!.property.name = 'AppEvents';

    rerender(<OrderBySection {...defaultProps} query={newQuery} />);

    const addButton = screen.getByLabelText('Add order by');
    expect(addButton).toBeInTheDocument();
  });
});
