import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';

import { createTheme, type Field, FieldType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type Column } from '@grafana/react-data-grid';

import { TableFilterProvider, useTableFilters } from '../TableFilterContext';
import { TABLE } from '../constants';
import { type TableRow, type TableSummaryRow } from '../types';

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

const hideableField = () => makeField({ config: { custom: { hideable: true } } });

const column = { key: 'Field1' } as Column<TableRow, TableSummaryRow>;

const baseProps = {
  column,
  rows: [] as TableRow[],
  selectFirstCell: jest.fn(),
  crossFilterRows: {},
  crossFilterTailRows: [] as TableRow[],
};

describe('HeaderCell', () => {
  it.each([false, true])(
    'keeps warning interactions separate from sorting with tableRefreshEnabled=%s',
    async (tableRefreshEnabled) => {
      const user = userEvent.setup();
      const onSort = jest.fn();
      const selectFirstCell = jest.fn();
      render(
        <div role="row">
          <div role="columnheader" onClick={onSort}>
            <HeaderCell
              {...baseProps}
              field={makeField()}
              tableRefreshEnabled={tableRefreshEnabled}
              selectFirstCell={selectFirstCell}
              warnings={[{ id: 'wrapping', message: 'Wrapping is disabled.' }]}
            />
          </div>
        </div>
      );
      await user.click(screen.getByRole('button', { name: 'Field warnings' }));
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Wrapping is disabled.');
      expect(onSort).not.toHaveBeenCalled();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Field1' })).toHaveFocus();
      expect(selectFirstCell).not.toHaveBeenCalled();
      await user.tab();
      expect(selectFirstCell).toHaveBeenCalledTimes(1);
    }
  );

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

  it('gives the header label the body text colour under table.refresh', () => {
    const theme = createTheme();
    const { unmount } = render(<HeaderCell {...baseProps} field={makeField()} tableRefreshEnabled />);
    expect(window.getComputedStyle(screen.getByRole('button', { name: 'Field1' })).color).toBe(
      theme.colors.text.primary
    );

    unmount();

    // the classic header sits on the same background as the body rows, so its label stays de-emphasised
    render(<HeaderCell {...baseProps} field={makeField()} />);
    expect(window.getComputedStyle(screen.getByRole('button', { name: 'Field1' })).color).toBe(
      theme.colors.text.secondary
    );
  });

  it('collapses the reorder drag handle until the header cell is hovered', () => {
    const { container } = render(
      <HeaderCell {...baseProps} field={makeField()} column={{ ...column, draggable: true }} tableRefreshEnabled />
    );
    const handle = container.querySelector('button[aria-hidden="true"]')!;
    const styles = window.getComputedStyle(handle);
    expect(styles.width).toBe('0px');
    expect(styles.opacity).toBe('0');
    expect(handle.querySelector('svg')).toBeInTheDocument();
  });

  it('does not sort when the reorder drag handle is clicked', async () => {
    const onHeaderClick = jest.fn();
    const { container } = render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onHeaderClick}>
        <HeaderCell {...baseProps} field={makeField()} column={{ ...column, draggable: true }} tableRefreshEnabled />
      </div>
    );

    await userEvent.click(container.querySelector('button[aria-hidden="true"]')!);

    expect(onHeaderClick).not.toHaveBeenCalled();
  });

  it('keeps the refreshed label colour when Wrap header text is toggled', () => {
    // The wrap option changes the label rule's own hash. While the refreshed colour lived in a second
    // class composed over it, that re-inserted rule landed *after* the override in the stylesheet and
    // won on order alone, so the label dropped back to the muted colour mid-session.
    const theme = createTheme();
    const { rerender } = render(<HeaderCell {...baseProps} field={makeField()} tableRefreshEnabled />);
    const labelColor = () => window.getComputedStyle(screen.getByRole('button', { name: 'Field1' })).color;
    expect(labelColor()).toBe(theme.colors.text.primary);

    rerender(
      <HeaderCell
        {...baseProps}
        field={makeField({ config: { custom: { wrapHeaderText: true } } })}
        tableRefreshEnabled
      />
    );
    expect(labelColor()).toBe(theme.colors.text.primary);

    rerender(<HeaderCell {...baseProps} field={makeField()} tableRefreshEnabled />);
    expect(labelColor()).toBe(theme.colors.text.primary);
  });

  it('keeps the sort arrow outside the truncating label under table.refresh', () => {
    // The refreshed label clips its own overflow to ellipsize a long title, so an arrow inside it
    // would be the first thing to disappear — exactly when the sort state matters most.
    const { container, unmount } = render(
      <HeaderCell {...baseProps} field={makeField()} direction="ASC" tableRefreshEnabled />
    );
    const label = screen.getByRole('button', { name: 'Field1' });
    expect(label.querySelector('svg')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();

    unmount();

    // the classic header's label doesn't shrink, so the arrow stays inside it
    render(<HeaderCell {...baseProps} field={makeField()} direction="ASC" />);
    expect(screen.getByRole('button', { name: 'Field1' }).querySelector('svg')).toBeInTheDocument();
  });

  it('lets the header label shrink so a long title truncates against the column menu', () => {
    // As a flex item the label won't shrink below its own min-content width unless min-width is 0,
    // and the refreshed header pins the column menu to the trailing edge for it to truncate against.
    const { unmount } = render(<HeaderCell {...baseProps} field={makeField()} tableRefreshEnabled />);
    expect(window.getComputedStyle(screen.getByRole('button', { name: 'Field1' })).minWidth).toBe('0');

    unmount();

    render(<HeaderCell {...baseProps} field={makeField()} />);
    expect(window.getComputedStyle(screen.getByRole('button', { name: 'Field1' })).minWidth).not.toBe('0');
  });

  it('sits the header controls with the last line of a wrapped title', () => {
    // A wrapped title grows downward while the controls beside it stay one line tall, so centring
    // them on the whole block leaves the arrow and the column menu floating against its middle.
    const wrapped = makeField({ config: { custom: { wrapHeaderText: true, filterable: true } } });
    const { container, unmount } = render(
      <HeaderCell {...baseProps} field={wrapped} direction="ASC" tableRefreshEnabled />
    );
    const root = container.firstElementChild!;
    const [labelGroup, menu] = Array.from(root.children);
    expect(window.getComputedStyle(root).alignItems).toBe('flex-end');
    expect(window.getComputedStyle(labelGroup).alignItems).toBe('flex-end');

    // ...and each control sits in a box one line tall, centred within it, so that it lines up with
    // the text rather than with the bottom of the cell: they're all shorter than the line box, by
    // different amounts, so aligning their edges would stagger them against the title.
    for (const box of [labelGroup.lastElementChild!, menu]) {
      expect(box).toHaveStyle({ height: `${TABLE.HEADER_LINE_HEIGHT}px`, alignItems: 'center' });
    }

    unmount();

    // an unwrapped title is one line tall itself, so its controls stay centred on it
    const oneLine = makeField({ config: { custom: { filterable: true } } });
    const { container: unwrapped } = render(
      <HeaderCell {...baseProps} field={oneLine} direction="ASC" tableRefreshEnabled />
    );
    const unwrappedRoot = unwrapped.firstElementChild!;
    expect(window.getComputedStyle(unwrappedRoot).alignItems).toBe('center');
    expect(window.getComputedStyle(unwrappedRoot.firstElementChild!).alignItems).toBe('center');
  });

  it('renders the label at the line box the header row is sized with', () => {
    // `useHeaderHeight` multiplies TABLE.HEADER_LINE_HEIGHT by the wrapped line count to size the
    // header row, so the label's own line box has to be that same number. A divergence is invisible
    // until a title wraps, and then shows up as a clipped or over-tall header.
    render(<HeaderCell {...baseProps} field={makeField({ config: { custom: { wrapHeaderText: true } } })} />);
    expect(window.getComputedStyle(screen.getByRole('button', { name: 'Field1' })).lineHeight).toBe(
      `${TABLE.HEADER_LINE_HEIGHT}px`
    );
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

  it('renders an info tooltip when headerTooltip is set', () => {
    render(
      <HeaderCell
        {...baseProps}
        field={makeField({ config: { custom: { headerTooltip: 'Only sorts the results on display' } } })}
      />
    );
    expect(screen.getByRole('button', { name: 'Only sorts the results on display' })).toBeInTheDocument();
  });

  it('renders the field description as an info tooltip when headerTooltip is not set', () => {
    render(<HeaderCell {...baseProps} field={makeField({ config: { description: 'Explains this column' } })} />);
    expect(screen.getByRole('button', { name: 'Explains this column' })).toBeInTheDocument();
  });

  it('prefers headerTooltip over the field description', () => {
    render(
      <HeaderCell
        {...baseProps}
        field={makeField({
          config: { description: 'Field description', custom: { headerTooltip: 'Custom header tooltip' } },
        })}
      />
    );
    expect(screen.getByRole('button', { name: 'Custom header tooltip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Field description' })).not.toBeInTheDocument();
  });

  it('does not render an info tooltip when headerTooltip is not set', () => {
    render(<HeaderCell {...baseProps} field={makeField()} />);
    expect(screen.getByRole('button', { name: 'Field1' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('does not bubble info tooltip clicks to the column header', async () => {
    const onHeaderClick = jest.fn();
    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onHeaderClick}>
        <HeaderCell
          {...baseProps}
          field={makeField({ config: { custom: { headerTooltip: 'Only sorts the results on display' } } })}
        />
      </div>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Only sorts the results on display' }));
    expect(onHeaderClick).not.toHaveBeenCalled();
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

  it('closes the previous filter popup when another filter is opened', async () => {
    const first = makeField({ config: { custom: { filterable: true } } });
    const second = makeField({
      name: 'Field2',
      values: ['x', 'y', 'z'],
      config: { custom: { filterable: true } },
    });
    render(
      <div onClick={(event) => event.stopPropagation()}>
        <TableFilterProvider props={{ data: { fields: [first, second], length: 3 }, width: 300, height: 200 }}>
          <HeaderCell {...baseProps} field={first} />
          <HeaderCell {...baseProps} field={second} column={{ key: 'Field2' } as Column<TableRow, TableSummaryRow>} />
        </TableFilterProvider>
      </div>
    );
    const firstButton = screen.getByLabelText('Filter Field1');
    const secondButton = screen.getByLabelText('Filter Field2');

    firstButton.focus();
    await userEvent.keyboard('{Enter}');
    expect(firstButton).toHaveAttribute('aria-expanded', 'true');
    secondButton.focus();
    await userEvent.keyboard('{Enter}');

    expect(firstButton).toHaveAttribute('aria-expanded', 'false');
    expect(secondButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId(selectors.components.Panels.Visualization.TableNG.Filters.Container)).toHaveLength(1);
  });

  it('can reopen a filter popup after its header remounts', async () => {
    const field = makeField({ config: { custom: { filterable: true } } });
    const props = { data: { fields: [field], length: 3 }, width: 300, height: 200 };
    const Header = ({ show }: { show: boolean }) => (
      <TableFilterProvider props={props}>{show && <HeaderCell {...baseProps} field={field} />}</TableFilterProvider>
    );
    const view = render(<Header show />);
    await userEvent.click(screen.getByLabelText('Filter Field1'));
    expect(screen.getByLabelText('Filter Field1')).toHaveAttribute('aria-expanded', 'true');

    view.rerender(<Header show={false} />);
    view.rerender(<Header show />);
    const remountedButton = screen.getByLabelText('Filter Field1');
    expect(remountedButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(remountedButton);
    expect(remountedButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(selectors.components.Panels.Visualization.TableNG.Filters.Container)).toBeInTheDocument();
  });

  it('closes the filter popup when an outside click stops propagation', async () => {
    const field = makeField({ config: { custom: { filterable: true } } });
    render(
      <div onClick={(event) => event.stopPropagation()}>
        <TableFilterProvider props={{ data: { fields: [field], length: 3 }, width: 300, height: 200 }}>
          <HeaderCell {...baseProps} field={field} />
          <button>Outside</button>
        </TableFilterProvider>
      </div>
    );
    const filterButton = screen.getByLabelText('Filter Field1');

    await userEvent.click(filterButton);
    expect(filterButton).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }));

    expect(filterButton).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByTestId(selectors.components.Panels.Visualization.TableNG.Filters.Container)
    ).not.toBeInTheDocument();
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

    it('does not escape special characters in the column menu name', () => {
      render(
        <HeaderCell
          {...baseProps}
          field={makeField({ name: 'Image w/ Link', config: { custom: { filterable: true } } })}
          tableRefreshEnabled
        />
      );
      expect(screen.getByRole('button', { name: 'Column options for Image w/ Link' })).toBeInTheDocument();
    });

    it('omits the menu when no actions are available', () => {
      render(<HeaderCell {...baseProps} field={makeField()} tableRefreshEnabled />);
      expect(screen.queryByLabelText(menuLabel)).not.toBeInTheDocument();
    });

    it('shows the menu for a hideable column', () => {
      render(<HeaderCell {...baseProps} field={hideableField()} tableRefreshEnabled onHideColumn={jest.fn()} />);
      expect(screen.getByLabelText(menuLabel)).toBeInTheDocument();
    });

    it('omits the menu for reordering without a sidebar', () => {
      render(
        <HeaderCell {...baseProps} field={makeField()} column={{ ...column, draggable: true }} tableRefreshEnabled />
      );
      expect(screen.queryByLabelText(menuLabel)).not.toBeInTheDocument();
    });

    it('shows the menu when the sidebar is available', () => {
      render(
        <HeaderCell
          {...baseProps}
          field={makeField()}
          column={{ ...column, draggable: true }}
          tableRefreshEnabled
          hasColumnSidebar
          onOpenColumnPanel={jest.fn()}
        />
      );
      expect(screen.getByLabelText(menuLabel)).toBeInTheDocument();
    });

    it('does not render an empty menu when column action callbacks are missing', () => {
      render(<HeaderCell {...baseProps} field={hideableField()} tableRefreshEnabled hasColumnSidebar />);
      expect(screen.getByRole('button', { name: 'Field1' })).toBeInTheDocument();
      expect(screen.queryByLabelText(menuLabel)).not.toBeInTheDocument();
    });

    it('opens the sidebar from Manage columns', async () => {
      const onOpenColumnPanel = jest.fn();
      render(
        <HeaderCell
          {...baseProps}
          field={makeField()}
          column={{ ...column, draggable: true }}
          tableRefreshEnabled
          hasColumnSidebar
          onOpenColumnPanel={onOpenColumnPanel}
        />
      );

      await userEvent.click(screen.getByLabelText(menuLabel));
      await userEvent.click(await screen.findByText('Manage columns'));
      expect(onOpenColumnPanel).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        filterable: true,
        expected: ['Filter values', '', 'Hide column', 'Manage columns', '', 'Add to Assistant'],
      },
      { filterable: false, expected: ['Hide column', 'Manage columns', '', 'Add to Assistant'] },
    ])(
      'groups column actions separately from filters and Assistant (filterable=$filterable)',
      async ({ filterable, expected }) => {
        render(
          <HeaderCell
            {...baseProps}
            field={makeField({ config: { custom: { filterable, hideable: true } } })}
            tableRefreshEnabled
            hasColumnSidebar
            onHideColumn={jest.fn()}
            canHideColumn
            onOpenColumnPanel={jest.fn()}
            onAddToAssistant={jest.fn()}
          />
        );

        await userEvent.click(screen.getByLabelText(menuLabel));
        const menu = await screen.findByRole('menu', { name: menuLabel });
        // Dividers have no text; their positions define the visible action groups.
        expect(Array.from(menu.children, (child) => child.textContent)).toEqual(expected);
      }
    );

    it('omits Manage columns when no columns are manageable', async () => {
      const onOpenColumnPanel = jest.fn();
      render(
        <HeaderCell
          {...baseProps}
          field={filterableField()}
          tableRefreshEnabled
          onOpenColumnPanel={onOpenColumnPanel}
        />
      );

      await userEvent.click(screen.getByLabelText(menuLabel));
      await screen.findByText('Filter values');
      expect(screen.queryByText('Manage columns')).not.toBeInTheDocument();
    });

    it('omits Manage columns without an open handler', async () => {
      render(<HeaderCell {...baseProps} field={hideableField()} tableRefreshEnabled onHideColumn={jest.fn()} />);

      await userEvent.click(screen.getByLabelText(menuLabel));
      await screen.findByText('Hide column');
      expect(screen.queryByText('Manage columns')).not.toBeInTheDocument();
    });

    it('disables Hide column for the last visible column', async () => {
      const onHideColumn = jest.fn();
      const { rerender } = render(
        <HeaderCell
          {...baseProps}
          field={hideableField()}
          tableRefreshEnabled
          onHideColumn={onHideColumn}
          canHideColumn
        />
      );

      await userEvent.click(screen.getByLabelText(menuLabel));
      const hideItem = await screen.findByText('Hide column');
      expect(hideItem.closest('button')).toBeEnabled();
      await userEvent.click(hideItem);
      expect(onHideColumn).toHaveBeenCalledTimes(1);

      rerender(
        <HeaderCell
          {...baseProps}
          field={hideableField()}
          tableRefreshEnabled
          onHideColumn={onHideColumn}
          canHideColumn={false}
        />
      );

      await userEvent.click(screen.getByLabelText(menuLabel));
      expect((await screen.findByText('Hide column')).closest('button')).toBeDisabled();
    });

    it('keeps the Assistant action out of the classic header', () => {
      render(<HeaderCell {...baseProps} field={makeField()} onAddToAssistant={jest.fn()} />);
      expect(screen.getByText('Field1')).toBeInTheDocument();
      expect(screen.queryByLabelText(menuLabel)).not.toBeInTheDocument();
    });

    it('scopes the menu reveal to its header cell', () => {
      const { container } = render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);
      expect(container.querySelector('.table-ng-header-cell')).toBeInTheDocument();
    });

    it('keeps the menu trigger visible while its filter is open and clears its open state on Escape', async () => {
      render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);

      await userEvent.click(screen.getByLabelText(menuLabel));
      const filterItem = await screen.findByText('Filter values');

      await userEvent.click(filterItem);
      // FilterPopup renders the value list with its own Ok/Cancel controls
      expect(await screen.findByRole('button', { name: 'Ok' })).toBeInTheDocument();
      expect(screen.getByLabelText(menuLabel)).toHaveStyle({ opacity: '1' });
      expect(screen.getByLabelText(menuLabel)).toHaveAttribute('data-filter-open', 'true');

      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('button', { name: 'Ok' })).not.toBeInTheDocument();
      expect(screen.getByLabelText(menuLabel)).not.toHaveAttribute('data-filter-open');
    });

    it('moves focus to the filter search input when the popup is opened from the column menu by keyboard', async () => {
      const user = userEvent.setup();
      render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);

      act(() => screen.getByLabelText(menuLabel).focus());
      await user.keyboard('{Enter}');
      const filterItem = await screen.findByRole('menuitem', { name: 'Filter values' });
      act(() => filterItem.focus());
      await user.keyboard('{Enter}');

      expect(await screen.findByRole('button', { name: 'Ok' })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByPlaceholderText('Filter values')).toHaveFocus());
    });

    it('returns focus to the column menu button when the filter popup is applied by keyboard', async () => {
      const user = userEvent.setup();
      render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);

      const menuButton = screen.getByLabelText(menuLabel);
      act(() => menuButton.focus());
      await user.keyboard('{Enter}');
      act(() => screen.getByRole('menuitem', { name: 'Filter values' }).focus());
      await user.keyboard('{Enter}');
      await waitFor(() => expect(screen.getByPlaceholderText('Filter values')).toHaveFocus());

      act(() => screen.getByRole('button', { name: 'Ok' }).focus());
      await user.keyboard('{Enter}');

      expect(menuButton).toHaveFocus();
      expect(screen.queryByRole('button', { name: 'Ok' })).not.toBeInTheDocument();
    });

    it('highlights only the funnel while its filter is open and clears the state on Cancel', async () => {
      const field = filterableField();
      const data = { fields: [field], length: 3 };
      const FilteredHeader = () => {
        const view = useTableFilters();
        useEffect(() => {
          view?.applyFilter(field, { id: 'inSet', options: { mode: 'display', values: ['a'] } });
        }, [view]);
        return <HeaderCell {...baseProps} field={field} tableRefreshEnabled />;
      };
      render(
        <TableFilterProvider props={{ data, width: 300, height: 200 }}>
          <FilteredHeader />
        </TableFilterProvider>
      );

      expect(await screen.findByLabelText(filterIconLabel)).toHaveAttribute('aria-haspopup', 'dialog');
      expect(screen.getByLabelText(menuLabel)).toHaveStyle({ opacity: '0' });

      await userEvent.click(screen.getByLabelText(filterIconLabel));
      expect(await screen.findByRole('button', { name: 'Ok' })).toBeInTheDocument();
      expect(screen.getByLabelText(filterIconLabel)).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByLabelText(menuLabel)).not.toHaveAttribute('data-filter-open');

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByLabelText(filterIconLabel)).toHaveAttribute('aria-expanded', 'false');
    });

    it.each([
      { reportedAs: 'the body', lostFocus: () => document.body },
      { reportedAs: 'the document element', lostFocus: () => document.documentElement },
      { reportedAs: 'null', lostFocus: () => null },
      { reportedAs: 'the removed filter icon', lostFocus: (filterIcon: HTMLElement) => filterIcon },
    ])(
      'moves focus to the column menu button when clearing the filter removes the filter icon (lost focus reported as $reportedAs)',
      async ({ lostFocus }) => {
        const field = filterableField();
        const data = { fields: [field], length: 3 };
        const FilteredHeader = () => {
          // Keyed on applyFilter, which stays stable across filter changes, so clearing is not undone.
          const applyFilter = useTableFilters()?.applyFilter;
          useEffect(() => {
            applyFilter?.(field, { id: 'inSet', options: { mode: 'display', values: ['a'] } });
          }, [applyFilter]);
          return <HeaderCell {...baseProps} field={field} tableRefreshEnabled />;
        };
        const user = userEvent.setup();
        render(
          <TableFilterProvider props={{ data, width: 300, height: 200 }}>
            <FilteredHeader />
          </TableFilterProvider>
        );
        const filterIcon = screen.getByLabelText(filterIconLabel);
        // jsdom always reports lost focus as the body, so stand in for browsers that report it differently.
        const readActiveElement = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement')!.get!;
        const activeElement = jest.spyOn(document, 'activeElement', 'get').mockImplementation(() => {
          const active = readActiveElement.call(document);
          return active === document.body && !filterIcon.isConnected ? lostFocus(filterIcon) : active;
        });

        act(() => filterIcon.focus());
        await user.keyboard('{Enter}');
        await waitFor(() => expect(screen.getByPlaceholderText('Filter values')).toHaveFocus());
        act(() => screen.getByRole('button', { name: 'Clear filter' }).focus());
        await user.keyboard('{Enter}');
        activeElement.mockRestore();

        expect(screen.getByLabelText(menuLabel)).toHaveFocus();
        expect(screen.queryByLabelText(filterIconLabel)).not.toBeInTheDocument();
      }
    );

    it('does not pull focus back into the header when the popup is dismissed by clicking empty space', async () => {
      const user = userEvent.setup();
      render(<HeaderCell {...baseProps} field={filterableField()} tableRefreshEnabled />);

      await user.click(screen.getByLabelText(menuLabel));
      await user.click(await screen.findByRole('menuitem', { name: 'Filter values' }));
      await waitFor(() => expect(screen.getByPlaceholderText('Filter values')).toHaveFocus());
      await user.click(document.body);

      expect(document.body).toHaveFocus();
      expect(screen.queryByRole('button', { name: 'Ok' })).not.toBeInTheDocument();
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

    // `table.refresh` puts the title, tooltip and active-filter icon in one wrapper, so "last child
    // element of the header" is no longer the same thing as "last tab stop in the header".
    const tooltipField = () => makeField({ config: { custom: { headerTooltip: 'Only counts displayed rows' } } });

    it('does not call selectFirstCell when tabbing from the title ahead of the header tooltip', () => {
      const { selectFirstCell } = renderInGrid({ field: tooltipField(), tableRefreshEnabled: true });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Field1' }), { key: 'Tab' });
      expect(selectFirstCell).not.toHaveBeenCalled();
    });

    it('calls selectFirstCell when tabbing from the header tooltip, the last tab stop in the cell', () => {
      const { selectFirstCell } = renderInGrid({ field: tooltipField(), tableRefreshEnabled: true });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Only counts displayed rows' }), { key: 'Tab' });
      expect(selectFirstCell).toHaveBeenCalledTimes(1);
    });

    it('calls selectFirstCell when tabbing from the column menu, past the title and tooltip', () => {
      const filterableTooltipField = () =>
        makeField({ config: { custom: { filterable: true, headerTooltip: 'Only counts displayed rows' } } });
      const { selectFirstCell } = renderInGrid({ field: filterableTooltipField(), tableRefreshEnabled: true });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Column options for Field1' }), { key: 'Tab' });
      expect(selectFirstCell).toHaveBeenCalledTimes(1);
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
