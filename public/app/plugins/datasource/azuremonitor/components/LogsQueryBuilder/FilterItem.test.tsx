import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorWhereExpressionItems,
} from '../../dataquery.gen';

import { FilterItem } from './FilterItem';

describe('FilterItem', () => {
  const mockFilter: BuilderQueryEditorWhereExpressionItems = {
    type: BuilderQueryEditorExpressionType.Operator,
    property: { name: 'Level', type: BuilderQueryEditorPropertyType.String },
    operator: { name: '==', value: 'Error' },
  };

  const mockSelectableOptions = [
    { label: 'Level', value: 'Level' },
    { label: 'Message', value: 'Message' },
    { label: 'TimeGenerated', value: 'TimeGenerated' },
  ];

  const mockGetFilterValues = jest.fn().mockResolvedValue([
    { label: 'Error', value: 'Error' },
    { label: 'Warning', value: 'Warning' },
    { label: 'Info', value: 'Info' },
  ]);

  const defaultProps = {
    filter: mockFilter,
    filterIndex: 0,
    groupIndex: 0,
    usedColumns: [],
    selectableOptions: mockSelectableOptions,
    onChange: jest.fn(),
    onDelete: jest.fn(),
    getFilterValues: mockGetFilterValues,
    showOr: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders column, operator, and remove button', () => {
    render(<FilterItem {...defaultProps} />);

    expect(screen.getByLabelText('Column')).toBeInTheDocument();
    expect(screen.getByLabelText('Operator')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove filter')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Error')).toBeInTheDocument();
  });

  it('renders OR label when showOr is true', () => {
    render(<FilterItem {...defaultProps} showOr={true} />);

    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  it('calls onChange when column changes', async () => {
    render(<FilterItem {...defaultProps} />);

    const columnSelect = screen.getByLabelText('Column');
    await userEvent.click(columnSelect);

    const messageOption = await screen.findByText('Message');
    await userEvent.click(messageOption);

    expect(defaultProps.onChange).toHaveBeenCalledWith(0, 'property', 'Message', 0);
  });

  it('calls onChange when operator changes', async () => {
    render(<FilterItem {...defaultProps} />);

    const operatorSelect = screen.getByLabelText('Operator');
    await userEvent.click(operatorSelect);

    const containsOption = await screen.findByText('contains');
    await userEvent.click(containsOption);

    expect(defaultProps.onChange).toHaveBeenCalledWith(0, 'operator', 'contains', 0);
  });

  it('calls onChange when column value changes', async () => {
    render(<FilterItem {...defaultProps} />);

    const valueCombobox = screen.getByDisplayValue('Error');
    await userEvent.click(valueCombobox);

    await waitFor(() => {
      expect(mockGetFilterValues).toHaveBeenCalled();
    });

    await userEvent.type(valueCombobox, 'Warning');
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(defaultProps.onChange).toHaveBeenCalledWith(0, 'value', 'Warning', 0);
  });

  it('calls onDelete when remove button is clicked', async () => {
    render(<FilterItem {...defaultProps} filterIndex={1} groupIndex={2} />);

    const deleteButton = screen.getByLabelText('Remove filter');
    await userEvent.click(deleteButton);

    expect(defaultProps.onDelete).toHaveBeenCalledWith(2, 1);
  });

  it('filters out used columns from selectable options', async () => {
    render(<FilterItem {...defaultProps} usedColumns={['Message']} />);

    const columnSelect = screen.getByLabelText('Column');
    await userEvent.click(columnSelect);

    expect(screen.queryByRole('option', { name: 'Message' })).not.toBeInTheDocument();
    expect(await screen.findByText('TimeGenerated')).toBeInTheDocument();
  });

  it('uses property name as key to reset Combobox when column changes', () => {
    const { rerender } = render(<FilterItem {...defaultProps} />);

    expect(screen.getByDisplayValue('Error')).toBeInTheDocument();

    const newFilter = {
      ...mockFilter,
      property: { name: 'Message', type: BuilderQueryEditorPropertyType.String },
      operator: { name: '==', value: '' },
    };

    rerender(<FilterItem {...defaultProps} filter={newFilter} />);
    expect(screen.queryByDisplayValue('Error')).not.toBeInTheDocument();
  });
});
