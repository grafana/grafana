import { fireEvent, render, screen } from '@testing-library/react';

import { type Field, FieldType } from '@grafana/data';
import { type Column } from '@grafana/react-data-grid';

import { type FilterType, type TableRow, type TableSummaryRow } from '../types';

import { HeaderCell } from './HeaderCell';

function makeField(overrides: Partial<Field> = {}): Field {
  return {
    name: 'Field1',
    type: FieldType.string,
    values: ['a', 'b', 'c'],
    config: {},
    state: {},
    ...overrides,
  };
}

const column = { key: 'Field1' } as Column<TableRow, TableSummaryRow>;

const baseProps = {
  column,
  rows: [] as TableRow[],
  filter: {} as FilterType,
  setFilter: jest.fn(),
  selectFirstCell: jest.fn(),
  crossFilterRows: {},
  crossFilterTailRows: [] as TableRow[],
};

describe('HeaderCell', () => {
  it('renders the display name', () => {
    render(<HeaderCell {...baseProps} field={makeField()} />);
    expect(screen.getByRole('button', { name: 'Field1' })).toBeInTheDocument();
  });

  it('prefers the state displayName over the field name', () => {
    render(<HeaderCell {...baseProps} field={makeField({ state: { displayName: 'Pretty Name' } })} />);
    expect(screen.getByRole('button', { name: 'Pretty Name' })).toBeInTheDocument();
  });

  it('renders a type icon when showTypeIcons is set', () => {
    const { container } = render(<HeaderCell {...baseProps} field={makeField()} showTypeIcons />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render a type icon by default', () => {
    const { container } = render(<HeaderCell {...baseProps} field={makeField()} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders an ascending sort arrow', () => {
    const { container } = render(<HeaderCell {...baseProps} field={makeField()} direction="ASC" />);
    expect(container.querySelector('[class*="css"]')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a descending sort arrow', () => {
    const { container } = render(<HeaderCell {...baseProps} field={makeField()} direction="DESC" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with wrapped header text when wrapHeaderText is enabled', () => {
    render(<HeaderCell {...baseProps} field={makeField({ config: { custom: { wrapHeaderText: true } } })} />);
    expect(screen.getByRole('button', { name: 'Field1' })).toBeInTheDocument();
  });

  it('renders a filter button when the field is filterable', () => {
    render(<HeaderCell {...baseProps} field={makeField({ config: { custom: { filterable: true } } })} />);
    expect(screen.getByLabelText('Filter Field1')).toBeInTheDocument();
  });

  it('does not render a filter button when the field is not filterable', () => {
    render(<HeaderCell {...baseProps} field={makeField()} />);
    expect(screen.queryByLabelText('Filter Field1')).not.toBeInTheDocument();
  });

  it('removes a stale filter for a field that is no longer filterable', () => {
    const setFilter = jest.fn();
    render(
      <HeaderCell
        {...baseProps}
        setFilter={setFilter}
        filter={{ Field1: { filtered: [], searchFilter: '' } } as unknown as FilterType}
        field={makeField()}
      />
    );
    expect(setFilter).toHaveBeenCalledTimes(1);
    // verify the updater removes the entry for this field
    const updater = setFilter.mock.calls[0][0];
    expect(updater({ Field1: { x: 1 }, Field2: { y: 2 } })).toEqual({ Field2: { y: 2 } });
  });

  it('does not remove a filter when the field is filterable', () => {
    const setFilter = jest.fn();
    render(
      <HeaderCell
        {...baseProps}
        setFilter={setFilter}
        filter={{ Field1: { filtered: [], searchFilter: '' } } as unknown as FilterType}
        field={makeField({ config: { custom: { filterable: true } } })}
      />
    );
    expect(setFilter).not.toHaveBeenCalled();
  });

  describe('keyboard handling', () => {
    // These tests dispatch a keydown against a *specific* target (a particular button, an SVG icon,
    // or a cell in a specific position) to exercise the handler's target/DOM-position logic. userEvent's
    // tab/keyboard helpers move focus globally and can't target an SVG or express "not the last element",
    // so fireEvent.keyDown is the right tool here.
    /* eslint-disable testing-library/prefer-user-event */

    // Mimics react-data-grid's DOM: <row><otherCell/><headerCell><HeaderCell/></headerCell></row>
    function renderInGrid(props = {}, { headerCellIsLast = true } = {}) {
      const selectFirstCell = jest.fn();
      render(
        <div role="row">
          <div>other cell</div>
          <div data-testid="header-cell">
            <HeaderCell {...baseProps} selectFirstCell={selectFirstCell} field={makeField()} {...props} />
          </div>
          {!headerCellIsLast && <div>trailing cell</div>}
        </div>
      );
      return { selectFirstCell };
    }

    it('calls selectFirstCell when tabbing out of the last element of the last header cell', () => {
      const { selectFirstCell } = renderInGrid();
      fireEvent.keyDown(screen.getByRole('button', { name: 'Field1' }), { key: 'Tab' });
      expect(selectFirstCell).toHaveBeenCalledTimes(1);
    });

    it('does not call selectFirstCell for a shift+tab', () => {
      const { selectFirstCell } = renderInGrid();
      fireEvent.keyDown(screen.getByRole('button', { name: 'Field1' }), { key: 'Tab', shiftKey: true });
      expect(selectFirstCell).not.toHaveBeenCalled();
    });

    it('does not call selectFirstCell for a non-Tab key', () => {
      const { selectFirstCell } = renderInGrid();
      fireEvent.keyDown(screen.getByRole('button', { name: 'Field1' }), { key: 'Enter' });
      expect(selectFirstCell).not.toHaveBeenCalled();
    });

    it('does not call selectFirstCell when the header cell is not the last cell in the row', () => {
      const { selectFirstCell } = renderInGrid({}, { headerCellIsLast: false });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Field1' }), { key: 'Tab' });
      expect(selectFirstCell).not.toHaveBeenCalled();
    });

    it('does not call selectFirstCell when tabbing from an element that is not the last in the header', () => {
      const selectFirstCell = jest.fn();
      render(
        <div role="row">
          <div data-testid="header-cell">
            <HeaderCell
              {...baseProps}
              selectFirstCell={selectFirstCell}
              field={makeField({ config: { custom: { filterable: true } } })}
            />
          </div>
        </div>
      );
      // the filter button is the last element in the header; tabbing from the (earlier) label button should not trigger
      fireEvent.keyDown(screen.getByRole('button', { name: 'Field1' }), { key: 'Tab' });
      expect(selectFirstCell).not.toHaveBeenCalled();
    });

    it('ignores the keydown when the event target is not an HTMLElement', () => {
      const selectFirstCell = jest.fn();
      const { container } = render(
        <div role="row">
          <div data-testid="header-cell">
            <HeaderCell {...baseProps} selectFirstCell={selectFirstCell} field={makeField()} showTypeIcons />
          </div>
        </div>
      );
      // SVG elements are SVGElement, not HTMLElement, so the handler bails early
      const svg = container.querySelector('svg')!;
      fireEvent.keyDown(svg, { key: 'Tab' });
      expect(selectFirstCell).not.toHaveBeenCalled();
    });

    it('does not attach a keydown handler when disableKeyboardEvents is set', () => {
      const { selectFirstCell } = renderInGrid({ disableKeyboardEvents: true });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Field1' }), { key: 'Tab' });
      expect(selectFirstCell).not.toHaveBeenCalled();
    });
    /* eslint-enable testing-library/prefer-user-event */
  });
});
