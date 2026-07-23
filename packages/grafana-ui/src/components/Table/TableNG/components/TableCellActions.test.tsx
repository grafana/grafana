import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Field, FieldType } from '@grafana/data';

import { TableCellInspectorMode } from '../../TableCellInspector';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, type TableCellActionsProps } from '../types';

import { TableCellActions } from './TableCellActions';

function setup(overrides: Partial<TableCellActionsProps> = {}) {
  const field: Field = {
    name: 'Field1',
    type: FieldType.string,
    values: ['a', 'b', 'c'],
    config: {},
  };
  const props: TableCellActionsProps = {
    field,
    value: 'hello',
    displayName: 'Field1',
    cellInspect: true,
    showFilters: true,
    setInspectCell: jest.fn(),
    onCellFilterAdded: jest.fn(),
    ...overrides,
  };
  render(<TableCellActions {...props} />);
  return props;
}

describe('TableCellActions', () => {
  it('renders the inspect button when cellInspect is true', () => {
    setup();
    expect(screen.getByLabelText('Inspect value')).toBeInTheDocument();
  });

  it('does not render the inspect button when cellInspect is false', () => {
    setup({ cellInspect: false });
    expect(screen.queryByLabelText('Inspect value')).not.toBeInTheDocument();
  });

  it('renders the filter buttons when showFilters is true', () => {
    setup();
    expect(screen.getByLabelText('Filter for value')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter out value')).toBeInTheDocument();
  });

  it('does not render the filter buttons when showFilters is false', () => {
    setup({ showFilters: false });
    expect(screen.queryByLabelText('Filter for value')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter out value')).not.toBeInTheDocument();
  });

  it('calls setInspectCell with the built inspect value when the inspect button is clicked', async () => {
    const { setInspectCell } = setup();
    await userEvent.click(screen.getByLabelText('Inspect value'));
    expect(setInspectCell).toHaveBeenCalledWith({ value: 'hello', mode: TableCellInspectorMode.text });
  });

  it('calls onCellFilterAdded with the "filter for" operator', async () => {
    const { onCellFilterAdded } = setup();
    await userEvent.click(screen.getByLabelText('Filter for value'));
    expect(onCellFilterAdded).toHaveBeenCalledWith({
      key: 'Field1',
      operator: FILTER_FOR_OPERATOR,
      value: 'hello',
    });
  });

  it('calls onCellFilterAdded with the "filter out" operator', async () => {
    const { onCellFilterAdded } = setup();
    await userEvent.click(screen.getByLabelText('Filter out value'));
    expect(onCellFilterAdded).toHaveBeenCalledWith({
      key: 'Field1',
      operator: FILTER_OUT_OPERATOR,
      value: 'hello',
    });
  });

  it('coerces nullish values to an empty string when filtering', async () => {
    const { onCellFilterAdded } = setup({ value: undefined });
    await userEvent.click(screen.getByLabelText('Filter for value'));
    expect(onCellFilterAdded).toHaveBeenCalledWith({
      key: 'Field1',
      operator: FILTER_FOR_OPERATOR,
      value: '',
    });
    await userEvent.click(screen.getByLabelText('Filter out value'));
    expect(onCellFilterAdded).toHaveBeenCalledWith({
      key: 'Field1',
      operator: FILTER_OUT_OPERATOR,
      value: '',
    });
  });

  it('does not throw when onCellFilterAdded is not provided', async () => {
    setup({ onCellFilterAdded: undefined });
    await userEvent.click(screen.getByLabelText('Filter for value'));
    await userEvent.click(screen.getByLabelText('Filter out value'));
    // no assertion needed beyond not throwing
    expect(screen.getByLabelText('Filter for value')).toBeInTheDocument();
  });

  it('stops click propagation so parent cell handlers are not triggered', async () => {
    const parentClick = jest.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div onClick={parentClick}>
        <TableCellActions
          field={{ name: 'Field1', type: FieldType.string, values: [], config: {} }}
          value="hello"
          displayName="Field1"
          cellInspect={true}
          showFilters={false}
          setInspectCell={jest.fn()}
        />
      </div>
    );
    await userEvent.click(screen.getByLabelText('Inspect value'));
    expect(parentClick).not.toHaveBeenCalled();
  });
});
