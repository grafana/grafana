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
  describe('refreshed menu', () => {
    it('opens inspection with the cell value and closes the menu', async () => {
      const { setInspectCell } = setup({ tableRefreshEnabled: true });
      await userEvent.click(screen.getByRole('button', { name: 'Cell actions' }));
      await userEvent.click(screen.getByText('Inspect value'));
      expect(setInspectCell).toHaveBeenCalledWith({ value: 'hello', mode: TableCellInspectorMode.text });
      expect(screen.getByRole('button', { name: 'Cell actions' })).toHaveAttribute('aria-expanded', 'false');
    });

    it.each([
      ['Filter for value', FILTER_FOR_OPERATOR, 'hello', 'hello'],
      ['Filter out value', FILTER_OUT_OPERATOR, 42, '42'],
      ['Filter for value', FILTER_FOR_OPERATOR, undefined, ''],
    ])('applies %s with operator %s and value %s', async (label, operator, value, expected) => {
      const { onCellFilterAdded } = setup({ tableRefreshEnabled: true, value });
      await userEvent.click(screen.getByRole('button', { name: 'Cell actions' }));
      await userEvent.click(screen.getByText(label));
      expect(onCellFilterAdded).toHaveBeenCalledWith({ key: 'Field1', operator, value: expected });
    });

    it.each([
      [true, false, ['Inspect value']],
      [false, true, ['Filter for value', 'Filter out value']],
    ])('offers only enabled actions (inspect=%s, filters=%s)', async (cellInspect, showFilters, labels) => {
      setup({ tableRefreshEnabled: true, cellInspect, showFilters });
      await userEvent.click(screen.getByRole('button', { name: 'Cell actions' }));
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(labels);
    });

    it('opens by keyboard and returns focus to the trigger on Escape', async () => {
      setup({ tableRefreshEnabled: true });
      const trigger = screen.getByRole('button', { name: 'Cell actions' });
      await userEvent.tab();
      expect(trigger).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await userEvent.keyboard('{Escape}');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveFocus();
    });

    it('does not activate cell links when using a portaled menu action', async () => {
      const parentClick = jest.fn();
      const setInspectCell = jest.fn();
      render(
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div onClick={parentClick}>
          <TableCellActions
            tableRefreshEnabled
            field={{ name: 'value', type: FieldType.string, values: [], config: {} }}
            value="hello"
            displayName="value"
            cellInspect
            showFilters={false}
            setInspectCell={setInspectCell}
          />
        </div>
      );
      await userEvent.click(screen.getByRole('button', { name: 'Cell actions' }));
      await userEvent.click(screen.getByText('Inspect value'));
      expect(setInspectCell).toHaveBeenCalledWith({ value: 'hello', mode: TableCellInspectorMode.text });
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

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
