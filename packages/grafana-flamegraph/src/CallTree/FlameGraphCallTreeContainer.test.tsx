import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDataFrame, FieldType } from '@grafana/data';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';
import { PaneView, ViewMode } from '../types';

import FlameGraphCallTreeContainer from './FlameGraphCallTreeContainer';

// Three allocation paths distinguish search direction and wrapping; each has callees below the initial expansion.
function createCallTreeData() {
  return createDataFrame({
    fields: [
      { name: 'level', type: FieldType.number, values: [0, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4] },
      { name: 'value', type: FieldType.number, values: [120, 60, 50, 40, 30, 40, 35, 25, 20, 20, 15, 10, 5] },
      { name: 'self', type: FieldType.number, values: [0, 10, 10, 10, 30, 5, 10, 5, 20, 5, 5, 5, 5] },
      {
        name: 'label',
        type: FieldType.string,
        values: [
          'total',
          'net/http.(*conn).serve',
          'app.handleRequest',
          'runtime.mallocgc',
          'runtime.memclrNoHeapPointers',
          'app.worker',
          'app.processBatch',
          'runtime.mallocgc',
          'runtime.heapBitsSetType',
          'app.scheduler',
          'app.scheduleTask',
          'runtime.mallocgc',
          'runtime.nextFreeFast',
        ],
      },
    ],
  });
}

describe('FlameGraphCallTreeContainer', () => {
  let user: ReturnType<typeof userEvent.setup>;

  // Needed for AutoSizer to work in test
  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });

    mockBoundingClientRect({ width: 1600, height: 500 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const setup = async (
    props?: Partial<React.ComponentProps<typeof FlameGraphCallTreeContainer>>,
    flameGraphData = createCallTreeData()
  ) => {
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });
    const onSymbolClick = jest.fn();
    const onSandwich = jest.fn();
    const onSearch = jest.fn();

    await act(async () => {
      render(
        <FlameGraphCallTreeContainer
          data={container}
          onSymbolClick={onSymbolClick}
          onSandwich={onSandwich}
          search=""
          onSearch={onSearch}
          {...props}
        />
      );
    });

    // Flush any pending timers (like queueMicrotask for compact mode)
    await act(async () => {
      jest.runAllTimers();
    });

    return { container, mocks: { onSymbolClick, onSandwich, onSearch } };
  };

  it('should render correctly', async () => {
    await setup(undefined, createDataFrame(data));

    const rows = screen.getAllByRole('row');
    // Should have header row + data rows
    expect(rows.length).toBeGreaterThan(1);

    const columnHeaders = screen.getAllByRole('columnheader');
    // Actions, Function, Color Bar, Self, Total
    expect(columnHeaders).toHaveLength(5);
    expect(columnHeaders[1].textContent).toEqual('Function');
    expect(columnHeaders[3].textContent).toEqual('Self');
    expect(columnHeaders[4].textContent).toContain('Total');

    // Check that the root function is rendered
    expect(screen.getByText('total')).toBeInTheDocument();

    // Check that cell values are rendered (the tree shows hierarchical data)
    const cells = screen.getAllByRole('cell');
    expect(cells.length).toBeGreaterThan(0);

    // Find cells containing formatted values (percentages)
    const cellTexts = cells.map((c) => c.textContent);
    // Root node should show 100% for total
    expect(cellTexts.some((t) => t?.includes('100.00%'))).toBeTruthy();
  });

  it('should render action menu with search option', async () => {
    const { mocks } = await setup();

    // Find the actions buttons (ellipsis icons that open dropdown menus)
    const actionButtons = screen.getAllByLabelText('Actions');
    expect(actionButtons.length).toBeGreaterThan(0);

    // Click the first action button to open the menu
    await user.click(actionButtons[0]);

    // The menu should show "Search" option
    expect(screen.getByText('Search')).toBeInTheDocument();

    // Click search and verify the callback is called
    await user.click(screen.getByText('Search'));

    expect(mocks.onSearch).toHaveBeenCalledWith('total');

    // Run timers to complete menu close animation (react-transition-group)
    await act(async () => {
      jest.runAllTimers();
    });
  });

  it('should render extra context menu buttons', async () => {
    const extraButtonClick = jest.fn();

    await setup({
      viewMode: ViewMode.Single,
      paneView: PaneView.CallTree,
      getExtraContextMenuButtons: () => {
        return [{ label: 'Custom Action', icon: 'eye', onClick: extraButtonClick }];
      },
    });

    // Open the action menu for the root node
    const actionButtons = screen.getAllByLabelText('Actions');
    await user.click(actionButtons[0]);

    // The custom action should be in the menu
    expect(screen.getByText('Custom Action')).toBeInTheDocument();

    // Click it and verify the callback
    await user.click(screen.getByText('Custom Action'));

    expect(extraButtonClick).toHaveBeenCalled();

    // Run timers to complete menu close animation (react-transition-group)
    await act(async () => {
      jest.runAllTimers();
    });
  });

  it('should show search navigation when search prop is provided', async () => {
    await setup({ search: 'http' });

    // Should show match counter when there are search results
    // The search finds matches in function names containing "http"
    expect(screen.getByText('1 of 1')).toBeInTheDocument();

    // Should have prev/next navigation buttons
    expect(screen.getByLabelText('Previous match')).toBeInTheDocument();
    expect(screen.getByLabelText('Next match')).toBeInTheDocument();
  });

  it('should show no matches message for non-matching search', async () => {
    await setup({ search: 'nonexistentfunction12345' });

    expect(screen.getByText('No matches found')).toBeInTheDocument();
  });

  it('should render in compact mode with fewer columns on narrow screens', async () => {
    // Override getBoundingClientRect to return a narrow width
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: jest.fn(() => ({
        width: 800,
        height: 500,
      })),
    });

    await setup();

    const columnHeaders = screen.getAllByRole('columnheader');
    // Compact mode: Actions, Function, Total (no Color Bar or Self columns)
    expect(columnHeaders).toHaveLength(3);
    expect(columnHeaders[1].textContent).toEqual('Function');
    expect(columnHeaders[2].textContent).toContain('Total');
  });

  it('should allow horizontal scrolling so nested function names are not clipped', async () => {
    await setup();

    const scrollContainer = screen.getByTestId('call-tree-scroll-container');
    expect(scrollContainer).toHaveStyle({ overflow: 'auto' });

    const columnHeaders = screen.getAllByRole('columnheader');
    const functionHeader = columnHeaders[1];
    // jsdom drops the max-content width, so assert the column is not locked to a pixel width.
    expect(functionHeader.style.width).not.toMatch(/^\d/);
    expect(functionHeader.style.minWidth).toBe('1054px');
    expect(functionHeader.style.whiteSpace).toBe('nowrap');

    const firstRowCells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    for (const [index, right] of [
      [2, '300px'],
      [3, '150px'],
      [4, '0px'],
    ] as const) {
      expect(columnHeaders[index]).toHaveStyle({ position: 'sticky', right });
      expect(firstRowCells[index]).toHaveStyle({ position: 'sticky', right });
    }
  });

  it('should enter focus mode when Focus on callees is clicked', async () => {
    // Use search to make runtime.mallocgc visible in the tree
    await setup({ search: 'runtime.mallocgc' });

    // The search expands the tree to show matching nodes
    const mallocgcButton = screen.getByText('runtime.mallocgc');
    expect(mallocgcButton).toBeInTheDocument();

    // Find the row containing runtime.mallocgc and click its action button
    const row = mallocgcButton.closest('tr');
    const actionButton = within(row!).getByLabelText('Actions');

    await user.click(actionButton);

    // Click "Focus on callees"
    await user.click(screen.getByText('Focus on callees'));

    // Run timers to complete menu close animation (react-transition-group)
    await act(async () => {
      jest.runAllTimers();
    });

    // The focus pill should appear in the toolbar showing the focused function
    // The pill shows the name after the last '/' - since runtime.mallocgc has no '/', it shows the full name
    expect(screen.getAllByText('runtime.mallocgc').length).toBeGreaterThan(1);
    // Should have a button to clear the focus
    expect(screen.getByLabelText('Clear callees view')).toBeInTheDocument();
    expect(screen.getByText('app.handleRequest')).toBeInTheDocument();
    expect(screen.getByText('runtime.memclrNoHeapPointers')).toBeInTheDocument();
  });

  it('should enter callers view when Show callers is clicked', async () => {
    // Use search to make runtime.mallocgc visible in the tree
    const { mocks } = await setup({ search: 'runtime.mallocgc' });

    // Find runtime.mallocgc in the tree
    const mallocgcButton = screen.getByText('runtime.mallocgc');
    const row = mallocgcButton.closest('tr');
    const actionButton = within(row!).getByLabelText('Actions');

    await user.click(actionButton);

    // Click "Show callers"
    await user.click(screen.getByText('Show callers'));

    // onSandwich should be called with the function name
    expect(mocks.onSandwich).toHaveBeenCalledWith('runtime.mallocgc');
    expect(screen.getByLabelText('Clear callers view')).toBeInTheDocument();
    expect(screen.getByText('app.handleRequest')).toBeInTheDocument();
    expect(screen.getByText('app.processBatch')).toBeInTheDocument();

    // Run timers to complete menu close animation (react-transition-group)
    await act(async () => {
      jest.runAllTimers();
    });
  });

  it('should report isSandwich to extra context menu buttons when in callers view', async () => {
    const observedIsSandwich: boolean[] = [];

    await setup({
      search: 'runtime.mallocgc',
      getExtraContextMenuButtons: (_clickedItemData, _data, state) => {
        observedIsSandwich.push(state.isSandwich);
        return [{ label: 'Custom Action', icon: 'eye', onClick: jest.fn() }];
      },
    });

    // Before entering callers view the regular call tree is shown.
    expect(observedIsSandwich.length).toBeGreaterThan(0);
    expect(observedIsSandwich.every((isSandwich) => isSandwich === false)).toBe(true);

    // Enter callers view via the action menu.
    const mallocgcButton = screen.getByText('runtime.mallocgc');
    const row = mallocgcButton.closest('tr');
    const actionButton = within(row!).getByLabelText('Actions');
    await user.click(actionButton);
    await user.click(screen.getByText('Show callers'));

    await act(async () => {
      jest.runAllTimers();
    });

    // Once in callers view the callback must observe sandwich mode.
    expect(observedIsSandwich).toContain(true);

    // Run timers to complete menu close animation (react-transition-group)
    await act(async () => {
      jest.runAllTimers();
    });
  });

  it('should navigate through search results with prev/next buttons', async () => {
    // Suppress console.error for floating-ui tooltip positioning warnings in jsdom
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    // This test uses real timers because the prev/next buttons have tooltips
    // that use @floating-ui/react-dom which doesn't play well with fake timers
    jest.useRealTimers();
    const realUser = userEvent.setup();

    await act(async () => {
      const flameGraphData = createCallTreeData();
      const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });
      render(
        <FlameGraphCallTreeContainer
          data={container}
          onSymbolClick={jest.fn()}
          onSandwich={jest.fn()}
          search="runtime.mallocgc"
          onSearch={jest.fn()}
        />
      );
    });

    // Should show multiple matches
    const matchCounter = screen.getByText(/of \d+/);
    expect(matchCounter).toBeInTheDocument();

    // Extract the total number of matches
    const matchText = matchCounter.textContent!;
    const totalMatches = parseInt(matchText.match(/of (\d+)/)![1], 10);
    expect(totalMatches).toBe(3);

    // Initial position should be "1 of N"
    expect(screen.getByText(`1 of ${totalMatches}`)).toBeInTheDocument();

    // Click next
    await realUser.click(screen.getByLabelText('Next match'));

    // Should now show "2 of N"
    expect(screen.getByText(`2 of ${totalMatches}`)).toBeInTheDocument();

    // Click previous
    await realUser.click(screen.getByLabelText('Previous match'));

    // Should be back to "1 of N"
    expect(screen.getByText(`1 of ${totalMatches}`)).toBeInTheDocument();

    await realUser.click(screen.getByLabelText('Previous match'));
    expect(screen.getByText('3 of 3')).toBeInTheDocument();

    await realUser.click(screen.getByLabelText('Next match'));
    expect(screen.getByText('1 of 3')).toBeInTheDocument();

    consoleError.mockRestore();
    // Restore fake timers for other tests
    jest.useFakeTimers();
  });

  it('paints pinned value cells with the row background', async () => {
    await setup({ search: 'runtime.mallocgc' });

    const rows = screen.getAllByRole('row').slice(1);
    const pinned = rows.flatMap((row) =>
      within(row)
        .getAllByRole('cell')
        .filter((cell) => cell.style.position === 'sticky')
    );

    // Color Bar, Self, and Total on every body row, including the search match.
    expect(pinned).toHaveLength(rows.length * 3);
    // Check the declaration: DOM emulators do not consistently resolve inherited backgrounds.
    const backgroundRules = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule && rule.style.getPropertyValue('background-color') !== ''
      );
    for (const cell of pinned) {
      const selectors = Array.from(cell.classList, (className) => `.${className}`);
      expect(
        backgroundRules
          .filter((rule) => selectors.includes(rule.selectorText))
          .map((rule) => rule.style.getPropertyValue('background-color'))
      ).toEqual(['inherit']);
    }
  });

  it('scrolls to the first search match when the tree renders with a search', async () => {
    const scrollTo = jest.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(() => {});

    await setup({ search: 'runtime.mallocgc' });

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: expect.any(Number), left: expect.any(Number) })
    );
    scrollTo.mockRestore();
  });

  it('expands and collapses a row when it is clicked anywhere', async () => {
    const { mocks } = await setup();
    const [toggle] = screen.getAllByRole('button', { expanded: false, name: (name) => name !== 'Actions' });
    const totalCell = within(toggle.closest('tr')!).getAllByRole('cell').at(-1)!;
    const rowCount = screen.getAllByRole('row').length;

    await user.click(totalCell);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('row').length).toBeGreaterThan(rowCount);
    expect(mocks.onSymbolClick).toHaveBeenCalledWith(toggle.textContent);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('row')).toHaveLength(rowCount);
  });

  it('does not toggle a row when its actions menu is used', async () => {
    const { mocks } = await setup();
    const [toggle] = screen.getAllByRole('button', { expanded: false, name: (name) => name !== 'Actions' });

    await user.click(within(toggle.closest('tr')!).getByLabelText('Actions'));
    await user.click(screen.getByText('Search'));
    await act(async () => {
      jest.runAllTimers();
    });

    expect(mocks.onSearch).toHaveBeenCalled();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
