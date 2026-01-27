import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDataFrame } from '@grafana/data';

import { FlameGraphDataContainer } from '../../FlameGraph/dataTransform';
import { data } from '../../FlameGraph/testData/dataNestedSet';
import { ColorScheme, PaneView, ViewMode } from '../../types';

import FlameGraphCallTreeContainer from './FlameGraphCallTreeContainer';

describe('FlameGraphCallTreeContainer', () => {
  let user: ReturnType<typeof userEvent.setup>;

  // Needed for AutoSizer to work in test
  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });

    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: jest.fn(() => ({
        width: 1600,
        height: 500,
      })),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const setup = async (props?: Partial<React.ComponentProps<typeof FlameGraphCallTreeContainer>>) => {
    const flameGraphData = createDataFrame(data);
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
          colorScheme={ColorScheme.ValueBased}
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
    await setup();

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

    expect(mocks.onSearch).toHaveBeenCalled();

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
    expect(screen.getByText(/of \d+/)).toBeInTheDocument();

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
      const flameGraphData = createDataFrame(data);
      const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });
      render(
        <FlameGraphCallTreeContainer
          data={container}
          onSymbolClick={jest.fn()}
          onSandwich={jest.fn()}
          colorScheme={ColorScheme.ValueBased}
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
    expect(totalMatches).toBeGreaterThan(1);

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

    consoleError.mockRestore();
    // Restore fake timers for other tests
    jest.useFakeTimers();
  });
});
