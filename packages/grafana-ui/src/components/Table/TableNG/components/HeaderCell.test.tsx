import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

  it('shows a pointer cursor and underlines the label on hover by default', () => {
    render(<HeaderCell {...baseProps} field={makeField()} />);
    const label = screen.getByRole('button', { name: 'Field1' });
    expect(window.getComputedStyle(label).cursor).toBe('pointer');
  });

  it('uses a default cursor and drops the hover underline when the field is not sortable', () => {
    render(<HeaderCell {...baseProps} field={makeField({ config: { custom: { sortable: false } } })} />);
    const label = screen.getByRole('button', { name: 'Field1' });
    expect(window.getComputedStyle(label).cursor).toBe('default');
  });

  it('renders nothing when hideHeader is set', () => {
    const { container } = render(
      <HeaderCell {...baseProps} field={makeField({ config: { custom: { hideHeader: true } } })} direction="ASC" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('still renders the display name when hideHeader is not set', () => {
    render(<HeaderCell {...baseProps} field={makeField()} />);
    expect(screen.getByRole('button', { name: 'Field1' })).toHaveAttribute('title', 'Field1');
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

  it('exposes the filter popover state via aria-expanded on the filter button', async () => {
    render(<HeaderCell {...baseProps} field={makeField({ config: { custom: { filterable: true } } })} />);
    const filterButton = screen.getByLabelText('Filter Field1');
    expect(filterButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(filterButton);
    expect(filterButton).toHaveAttribute('aria-expanded', 'true');
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

  describe('table.refresh', () => {
    const filterableField = () => makeField({ config: { custom: { filterable: true } } });
    const menuLabel = 'Column options for Field1';
    const filterIconLabel = 'Edit filter on Field1';

    it('keeps the inline filter button and renders no column menu when the flag is off', () => {
      render(<HeaderCell {...baseProps} field={filterableField()} />);
      expect(screen.getByLabelText('Filter Field1')).toBeInTheDocument();
      expect(screen.queryByLabelText(menuLabel)).not.toBeInTheDocument();
    });

    it('replaces the inline filter button with a column menu when the flag is on', () => {
      render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);
      expect(screen.queryByLabelText('Filter Field1')).not.toBeInTheDocument();
      expect(screen.getByLabelText(menuLabel)).toBeInTheDocument();
    });

    it('renders no column menu for a non-filterable column with no pin/hide handlers', () => {
      render(<HeaderCell {...baseProps} field={makeField()} tableRefreshEnabled />);
      expect(screen.queryByLabelText(menuLabel)).not.toBeInTheDocument();
    });

    it('renders a column menu for a non-filterable column once pin/hide are available', () => {
      render(
        <HeaderCell
          {...baseProps}
          field={makeField()}
          tableRefreshEnabled
          onTogglePin={jest.fn()}
          onHideColumn={jest.fn()}
        />
      );
      expect(screen.getByLabelText(menuLabel)).toBeInTheDocument();
    });

    it('pins and unpins a column from the column menu', async () => {
      const onTogglePin = jest.fn();
      const { rerender } = render(
        <HeaderCell {...baseProps} field={makeField()} tableRefreshEnabled onTogglePin={onTogglePin} />
      );

      await userEvent.click(screen.getByLabelText(menuLabel));
      await userEvent.click(await screen.findByText('Pin column left'));
      expect(onTogglePin).toHaveBeenCalledTimes(1);

      rerender(
        <HeaderCell {...baseProps} field={makeField()} tableRefreshEnabled onTogglePin={onTogglePin} isPinned />
      );

      await userEvent.click(screen.getByLabelText(menuLabel));
      expect(await screen.findByText('Unpin column')).toBeInTheDocument();
    });

    it('hides a column from the column menu, disabled when it is the last visible column', async () => {
      const onHideColumn = jest.fn();
      const { rerender } = render(
        <HeaderCell {...baseProps} field={makeField()} tableRefreshEnabled onHideColumn={onHideColumn} canHideColumn />
      );

      await userEvent.click(screen.getByLabelText(menuLabel));
      const hideItem = await screen.findByText('Hide column');
      expect(hideItem.closest('button')).toBeEnabled();
      await userEvent.click(hideItem);
      expect(onHideColumn).toHaveBeenCalledTimes(1);

      rerender(
        <HeaderCell
          {...baseProps}
          field={makeField()}
          tableRefreshEnabled
          onHideColumn={onHideColumn}
          canHideColumn={false}
        />
      );

      await userEvent.click(screen.getByLabelText(menuLabel));
      expect((await screen.findByText('Hide column')).closest('button')).toBeDisabled();
    });

    it('gives the header cell root a stable class the menu scopes its hover reveal to', () => {
      // Regression guard: the column menu's hover/focus-reveal CSS matches this class rather than
      // the bare `.rdg-cell` react-data-grid puts on every header cell. In a nested table, a
      // column's header cell also sits inside the *outer* grid's nested-frame `.rdg-cell`, and
      // `:hover`/`:focus-within` bubble up to that ancestor — matching on bare `.rdg-cell` would
      // reveal every column's menu in the nested table at once. See HeaderCellMenu's styles.
      const { container } = render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);
      expect(container.querySelector('.table-ng-header-cell')).toBeInTheDocument();
    });

    it('opens the filter popup from the column menu', async () => {
      render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);

      await userEvent.click(screen.getByLabelText(menuLabel));
      const filterItem = await screen.findByText('Filter values');

      await userEvent.click(filterItem);
      // FilterPopup renders the value list with its own Ok/Cancel controls
      expect(await screen.findByRole('button', { name: 'Ok' })).toBeInTheDocument();
    });

    it('marks a filtered column with a persistent filter icon, leaving the menu hover-only', () => {
      const activeFilter = { Field1: { filtered: [{ value: 'a' }], displayName: 'Field1' } } as unknown as FilterType;
      const { rerender } = render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);

      expect(screen.queryByLabelText(filterIconLabel)).not.toBeInTheDocument();
      // the menu stays hidden until the header cell is hovered or focused
      expect(screen.getByLabelText(menuLabel)).toHaveStyle({ opacity: '0' });

      rerender(<HeaderCell {...baseProps} field={filterableField()} filter={activeFilter} tableRefreshEnabled />);

      expect(screen.getByLabelText(filterIconLabel)).toBeInTheDocument();
      // an active filter is reported by the icon, so the menu is not pinned visible
      expect(screen.getByLabelText(menuLabel)).toHaveStyle({ opacity: '0' });
    });

    it('labels the filter menu item "Update filter" once the column has an active filter', async () => {
      const activeFilter = { Field1: { filtered: [{ value: 'a' }], displayName: 'Field1' } } as unknown as FilterType;
      const { rerender } = render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);

      await userEvent.click(screen.getByLabelText(menuLabel));
      expect(await screen.findByText('Filter values')).toBeInTheDocument();
      expect(screen.queryByText('Update filter')).not.toBeInTheDocument();

      // the dropdown stays open across the rerender and its content re-renders reactively, so the
      // label updates without needing to reopen the menu
      rerender(<HeaderCell {...baseProps} field={filterableField()} filter={activeFilter} tableRefreshEnabled />);

      expect(await screen.findByText('Update filter')).toBeInTheDocument();
      expect(screen.queryByText('Filter values')).not.toBeInTheDocument();
    });

    it('reopens the filter popup from the filter icon', async () => {
      const activeFilter = { Field1: { filtered: [{ value: 'a' }], displayName: 'Field1' } } as unknown as FilterType;
      render(<HeaderCell {...baseProps} field={filterableField()} filter={activeFilter} tableRefreshEnabled />);

      await userEvent.click(screen.getByLabelText(filterIconLabel));

      // the same popup the column menu opens, so the filter can be adjusted or cleared in one click
      expect(await screen.findByRole('button', { name: 'Ok' })).toBeInTheDocument();
    });

    it('does not sort the column when the filter icon is clicked', async () => {
      const activeFilter = { Field1: { filtered: [{ value: 'a' }], displayName: 'Field1' } } as unknown as FilterType;
      const onHeaderClick = jest.fn();
      render(
        // react-data-grid sorts on a click anywhere in the header cell, so the button must not bubble
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div onClick={onHeaderClick}>
          <HeaderCell {...baseProps} field={filterableField()} filter={activeFilter} tableRefreshEnabled />
        </div>
      );

      await userEvent.click(screen.getByLabelText(filterIconLabel));

      expect(onHeaderClick).not.toHaveBeenCalled();
    });

    it('does not sort the column when the filter popup itself is clicked', async () => {
      const activeFilter = { Field1: { filtered: [{ value: 'a' }], displayName: 'Field1' } } as unknown as FilterType;
      const onHeaderClick = jest.fn();
      render(
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div onClick={onHeaderClick}>
          <HeaderCell {...baseProps} field={filterableField()} filter={activeFilter} tableRefreshEnabled />
        </div>
      );

      await userEvent.click(screen.getByLabelText(filterIconLabel));
      const cancel = await screen.findByRole('button', { name: 'Cancel' });
      onHeaderClick.mockClear();

      // Popover portals out of the header cell, but React events bubble along the React tree, so
      // without an explicit guard this click reaches react-data-grid's sort handler.
      await userEvent.click(cancel);

      expect(onHeaderClick).not.toHaveBeenCalled();
    });

    it('keys the filter icon by parent index on a nested table', () => {
      const nested = { 'Field1-2': { filtered: [{ value: 'a' }], displayName: 'Field1' } } as unknown as FilterType;

      const { rerender } = render(
        <HeaderCell {...baseProps} field={filterableField()} filter={nested} parentIndex={2} tableRefreshEnabled />
      );
      expect(screen.getByLabelText(filterIconLabel)).toBeInTheDocument();

      // a sibling parent with no filter of its own shows no icon
      rerender(
        <HeaderCell {...baseProps} field={filterableField()} filter={nested} parentIndex={3} tableRefreshEnabled />
      );
      expect(screen.queryByLabelText(filterIconLabel)).not.toBeInTheDocument();
    });

    it('renders the filter icon at the type icon size, not the sort arrow size', () => {
      const activeFilter = { Field1: { filtered: [{ value: 'a' }], displayName: 'Field1' } } as unknown as FilterType;
      const { container } = render(
        <HeaderCell
          {...baseProps}
          field={filterableField()}
          filter={activeFilter}
          direction="ASC"
          showTypeIcons
          tableRefreshEnabled
        />
      );

      const filterIcon = screen.getByLabelText(filterIconLabel).querySelector('svg')!;
      const typeIcon = screen.getByTitle('string').closest('svg')!;
      const sortArrow = [...container.querySelectorAll('svg')].find((svg) => svg !== filterIcon && svg !== typeIcon)!;

      // The funnel fills its box where the arrow is a thin glyph, so rendering both at the arrow's
      // "lg" made the funnel read as oversized. It tracks the type icon's size instead.
      // Icon puts its size on width/height, not the class — every Icon shares one emotion class.
      expect(filterIcon).toHaveAttribute('width', typeIcon.getAttribute('width')!);
      expect(filterIcon).toHaveAttribute('width', '14');
      expect(sortArrow).toHaveAttribute('width', '18');
      // still the same colour as the sort arrow: both report state
      const sortColor = getComputedStyle(sortArrow).color;
      expect(sortColor).not.toBe('');
      expect(getComputedStyle(filterIcon).color).toBe(sortColor);
      // and adjacent to it, ahead of the trailing menu
      expect(filterIcon.closest('div')).toBe(sortArrow.closest('div'));
    });

    it('renders no filter icon when the flag is off', () => {
      const activeFilter = { Field1: { filtered: [{ value: 'a' }], displayName: 'Field1' } } as unknown as FilterType;
      render(<HeaderCell {...baseProps} field={filterableField()} filter={activeFilter} />);
      expect(screen.queryByTitle('Filtered')).not.toBeInTheDocument();
    });
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
