import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorReduceExpression,
  BuilderQueryEditorReduceParameterTypes,
} from '../../dataquery.gen';

import AggregateItem from './AggregateItem';

describe('AggregateItem', () => {
  const mockColumns = [
    { label: 'TimeGenerated', value: 'TimeGenerated' },
    { label: 'Level', value: 'Level' },
    { label: 'Message', value: 'Message' },
  ];

  const mockTemplateVariables = { label: '$variable', value: '$variable' };

  const defaultAggregate: BuilderQueryEditorReduceExpression = {
    reduce: {
      name: 'sum',
      type: BuilderQueryEditorPropertyType.Function,
      parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
    },
    property: {
      name: 'TimeGenerated',
      type: BuilderQueryEditorPropertyType.String,
    },
  };

  const defaultProps = {
    aggregate: defaultAggregate,
    columns: mockColumns,
    onChange: jest.fn(),
    onDelete: jest.fn(),
    templateVariableOptions: mockTemplateVariables,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders aggregate function select (with column field)', () => {
    render(<AggregateItem {...defaultProps} />);
    expect(screen.getByLabelText('Aggregate function')).toBeInTheDocument();
    expect(screen.getByLabelText('Column')).toBeInTheDocument();
  });

  it('does not render column select for count aggregates', () => {
    const countAggregate = {
      ...defaultAggregate,
      reduce: {
        name: 'count',
        type: BuilderQueryEditorPropertyType.Function,
        parameterType: BuilderQueryEditorReduceParameterTypes.Generic,
      },
    };
    render(<AggregateItem {...defaultProps} aggregate={countAggregate} />);
    expect(screen.queryByLabelText('Column')).not.toBeInTheDocument();
  });

  it('renders percentile input and OF label for percentile aggregate', () => {
    const percentileAggregate: BuilderQueryEditorReduceExpression = {
      reduce: {
        name: 'percentile',
        type: BuilderQueryEditorPropertyType.Function,
        parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
      },
      parameters: [
        {
          type: BuilderQueryEditorExpressionType.Function_parameter,
          fieldType: BuilderQueryEditorPropertyType.Number,
          value: '95',
        },
        {
          type: BuilderQueryEditorExpressionType.Function_parameter,
          fieldType: BuilderQueryEditorPropertyType.String,
          value: 'TimeGenerated',
        },
      ],
      property: {
        name: 'TimeGenerated',
        type: BuilderQueryEditorPropertyType.String,
      },
    };
    render(<AggregateItem {...defaultProps} aggregate={percentileAggregate} />);
    expect(screen.getByDisplayValue('95')).toBeInTheDocument();
    expect(screen.getByText('OF')).toBeInTheDocument();
  });

  it('calls onChange when aggregate function changes', async () => {
    render(<AggregateItem {...defaultProps} />);

    const select = screen.getByLabelText('Aggregate function');
    await userEvent.click(select);

    const avgOption = await screen.findByText('avg');
    await userEvent.click(avgOption);

    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        reduce: expect.objectContaining({
          name: 'avg',
          parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
        }),
      })
    );
  });

  it('calls onChange when column changes', async () => {
    render(<AggregateItem {...defaultProps} />);

    const columnSelect = screen.getByLabelText('Column');
    await userEvent.click(columnSelect);
    const levelOption = await screen.findByText('Level');
    await userEvent.click(levelOption);

    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        property: expect.objectContaining({
          name: 'Level',
        }),
      })
    );
  });

  it('calls onChange when percentile value changes', async () => {
    const percentileAggregate: BuilderQueryEditorReduceExpression = {
      reduce: {
        name: 'percentile',
        type: BuilderQueryEditorPropertyType.Function,
        parameterType: BuilderQueryEditorReduceParameterTypes.Numeric,
      },
      parameters: [
        {
          type: BuilderQueryEditorExpressionType.Function_parameter,
          fieldType: BuilderQueryEditorPropertyType.Number,
          value: '95',
        },
        {
          type: BuilderQueryEditorExpressionType.Function_parameter,
          fieldType: BuilderQueryEditorPropertyType.String,
          value: 'TimeGenerated',
        },
      ],
    };
    render(<AggregateItem {...defaultProps} aggregate={percentileAggregate} />);

    const percentileInput = screen.getByDisplayValue('95');
    await userEvent.clear(percentileInput);
    await userEvent.type(percentileInput, '99');

    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters: expect.arrayContaining([expect.objectContaining({ value: '99' })]),
      })
    );
  });

  it('calls onDelete when delete button clicked', async () => {
    render(<AggregateItem {...defaultProps} />);

    const deleteButton = screen.getByLabelText('Remove');
    await userEvent.click(deleteButton);
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it('includes template variables in column options', async () => {
    render(<AggregateItem {...defaultProps} />);

    const columnSelect = screen.getByLabelText('Column');
    await userEvent.click(columnSelect);
    expect(await screen.findByText('$variable')).toBeInTheDocument();
  });

  it('handles array of template variables', async () => {
    const arrayTemplateVars = [
      { label: '$var1', value: '$var1' },
      { label: '$var2', value: '$var2' },
    ];
    render(<AggregateItem {...defaultProps} templateVariableOptions={arrayTemplateVars[0]} />);

    const columnSelect = screen.getByLabelText('Column');
    await userEvent.click(columnSelect);

    expect(await screen.findByText('$var1')).toBeInTheDocument();
  });
});
