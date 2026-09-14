import { render, screen, waitFor, within } from '@testing-library/react';
import userEvents from '@testing-library/user-event';

import { createDataFrame } from '@grafana/data';
import { mockBoundingClientRect, mockClientSize } from '@grafana/test-utils';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';
import { textToDataContainer } from '../FlameGraph/testHelpers';
import { ColorScheme, ColorSchemeDiff } from '../types';

import FlameGraphTopTableContainer, { buildFilteredTable } from './FlameGraphTopTableContainer';

// AutoSizer needs a measurable rect, and react-data-grid additionally sizes its virtualized viewport
// from the client box - jsdom reports 0 for both.
function mockTableSize({ width, height }: { width: number; height: number } = { width: 500, height: 500 }) {
  mockBoundingClientRect({ width, height });
  mockClientSize({ width, height });
}

describe('FlameGraphTopTableContainer', () => {
  const setup = (props?: { useTableNG?: boolean }) => {
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });
    const onSearch = jest.fn();
    const onSandwich = jest.fn();

    const renderResult = render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={onSearch}
        onSandwich={onSandwich}
        colorScheme={ColorScheme.ValueBased}
        useTableNG={props?.useTableNG}
      />
    );

    return { renderResult, mocks: { onSearch, onSandwich } };
  };

  it('should render correctly', async () => {
    mockTableSize();

    setup();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(16);

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(4);
    expect(columnHeaders[1].textContent).toEqual('Symbol');
    expect(columnHeaders[2].textContent).toEqual('Self');
    expect(columnHeaders[3].textContent).toEqual('Total');

    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(60); // 16 rows
    expect(cells[1].textContent).toEqual('net/http.HandlerFunc.ServeHTTP');
    expect(cells[2].textContent).toEqual('31.7 K');
    expect(cells[3].textContent).toEqual('5.58 Bil');
    expect(cells[5].textContent).toEqual('total');
    expect(cells[6].textContent).toEqual('16.5 K');
    expect(cells[7].textContent).toEqual('16.5 Bil');
    expect(cells[25].textContent).toEqual('net/http.(*conn).serve');
    expect(cells[26].textContent).toEqual('5.63 K');
    expect(cells[27].textContent).toEqual('5.63 Bil');
  });

  it('should render search and sandwich buttons', async () => {
    // Needed for AutoSizer to work in test
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 500,
        height: 500,
        left: 0,
      })),
    });

    const { mocks } = setup();

    const searchButtons = screen.getAllByLabelText(/Search for symbol/);
    expect(searchButtons.length > 0).toBeTruthy();
    await userEvents.click(searchButtons[0]);

    expect(mocks.onSearch).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');

    const sandwichButtons = screen.getAllByLabelText(/Show in sandwich view/);
    expect(sandwichButtons.length > 0).toBeTruthy();
    await userEvents.click(sandwichButtons[0]);

    expect(mocks.onSandwich).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');
  });
});

describe('FlameGraphTopTableContainer with "other" data', () => {
  // A minimal flame graph whose "other" node aggregates the truncated part: self and total are both 3, while
  // the smallest node in the whole graph (lib, total: 2) is the truncation threshold.
  const dataWithOther = createDataFrame({
    fields: [
      { name: 'level', values: [0, 1, 1, 1] },
      { name: 'value', values: [10, 5, 3, 2] },
      { name: 'self', values: [0, 5, 3, 2] },
      { name: 'label', values: ['total', 'app', 'other', 'lib'] },
    ],
  });

  const setup = () => {
    const container = new FlameGraphDataContainer(dataWithOther, { collapsing: true });
    const onSearch = jest.fn();
    const onSandwich = jest.fn();

    const renderResult = render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={onSearch}
        onSandwich={onSandwich}
        colorScheme={ColorScheme.ValueBased}
      />
    );

    return { renderResult, mocks: { onSearch, onSandwich } };
  };

  it('should render a note about the truncated "other" data instead of a row', async () => {
    mockTableSize();
    setup();

    // "other" is no longer rendered as a row in the table.
    expect(screen.queryByText('other')).not.toBeInTheDocument();
    expect(screen.getByText('app')).toBeInTheDocument();
    expect(screen.getByText('lib')).toBeInTheDocument();

    // Instead a note is rendered below the table, explaining what "other" is. 3 is the total that was truncated
    // into "other" and 2 the minimum total in the flame graph (the truncation threshold).
    const note = screen.getByTestId('topTable-other-note');
    expect(note.textContent).toContain('has been truncated');
    expect(note.textContent).toContain('represented by "other" in the flamegraph');
    expect(within(note).getByText('3')).toBeInTheDocument();
    expect(within(note).getByText('2')).toBeInTheDocument();
  });

  it('should render the truncated totals with the value unit in the note', async () => {
    mockTableSize();
    // Same shape as dataWithOther but the value field is scaled so the display processor emits an SI suffix
    // ("3 K"/"2 K"). The note must include that suffix, otherwise "3" and "2" are ambiguous.
    const dataWithOtherAndUnit = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10000, 5000, 3000, 2000], config: { unit: 'short' } },
        { name: 'self', values: [0, 5000, 3000, 2000], config: { unit: 'short' } },
        { name: 'label', values: ['total', 'app', 'other', 'lib'] },
      ],
    });
    const container = new FlameGraphDataContainer(dataWithOtherAndUnit, { collapsing: true });

    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        colorScheme={ColorScheme.ValueBased}
      />
    );

    const note = screen.getByTestId('topTable-other-note');
    expect(within(note).getByText('3 K')).toBeInTheDocument();
    expect(within(note).getByText('2 K')).toBeInTheDocument();
  });

  it('should not let nested "other" leftovers lower the truncation threshold', async () => {
    mockTableSize();
    // A level-2 "other" leftover (1) sits under "lib". It aggregates children that fell below the cutoff, so it is
    // itself smaller than the real truncation threshold (lib, total: 2) and must be excluded from the minimum.
    const dataWithNestedOther = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1, 2] },
        { name: 'value', values: [10, 5, 3, 2, 1] },
        { name: 'self', values: [0, 5, 3, 2, 1] },
        { name: 'label', values: ['total', 'app', 'other', 'lib', 'other'] },
      ],
    });
    const container = new FlameGraphDataContainer(dataWithNestedOther, { collapsing: true });

    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        colorScheme={ColorScheme.ValueBased}
      />
    );

    const note = screen.getByTestId('topTable-other-note');
    // The truncated total aggregates both "other" nodes (3 + 1).
    expect(within(note).getByText('4')).toBeInTheDocument();
    // The threshold stays the minimum among the real (non-"other") nodes, i.e. lib with total 2.
    expect(within(note).getByText('2')).toBeInTheDocument();
    expect(within(note).queryByText('1')).not.toBeInTheDocument();
  });

  it('should account for both sides of a diff flamegraph in the truncation note', async () => {
    mockTableSize();
    // A diff flamegraph whose "other" node aggregates truncated stacktraces from both profiles. The smallest real
    // node ("lib") exists only in the comparison profile, so its baseline total is 0 - a baseline-only minimum
    // would wrongly report the truncation threshold as 0.
    const diffDataWithOther = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [8, 5, 3, 0] },
        { name: 'valueRight', values: [11, 5, 4, 2] },
        { name: 'self', values: [0, 5, 3, 0] },
        { name: 'selfRight', values: [0, 5, 4, 2] },
        { name: 'label', values: ['total', 'app', 'other', 'lib'] },
      ],
    });
    const container = new FlameGraphDataContainer(diffDataWithOther, { collapsing: true });

    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        colorScheme={ColorSchemeDiff.DiffColorBlind}
      />
    );

    const note = screen.getByTestId('topTable-other-note');
    // The truncated total is shown for the baseline (3) and the comparison (4) side.
    expect(within(note).getByText('3')).toBeInTheDocument();
    expect(within(note).getByText('4')).toBeInTheDocument();
    // The threshold is the smallest total present on either side (lib, comparison: 2), not the 0 of the
    // baseline side where the function doesn't exist.
    expect(within(note).getByText('2')).toBeInTheDocument();
    expect(within(note).queryByText('0')).not.toBeInTheDocument();
  });

  it('should render search and sandwich buttons for "other" in the note', async () => {
    mockTableSize();
    const { mocks } = setup();

    await userEvents.click(screen.getByRole('button', { name: 'Search for "other"' }));
    expect(mocks.onSearch).toHaveBeenCalledWith('other');

    await userEvents.click(screen.getByRole('button', { name: 'Show "other" in sandwich view' }));
    expect(mocks.onSandwich).toHaveBeenCalledWith('other');
  });

  it('should not render the truncation note when there is no "other" data', async () => {
    mockTableSize();
    const container = new FlameGraphDataContainer(createDataFrame(data), { collapsing: true });

    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        colorScheme={ColorScheme.ValueBased}
      />
    );

    expect(screen.queryByTestId('topTable-other-note')).not.toBeInTheDocument();
  });
});
describe('FlameGraphTopTableContainer with useTableNG', () => {
  const setup = (props?: { tableRefreshEnabled?: boolean }) => {
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });
    const onSearch = jest.fn();
    const onSandwich = jest.fn();

    const renderResult = render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={onSearch}
        onSandwich={onSandwich}
        colorScheme={ColorScheme.ValueBased}
        useTableNG={true}
        tableRefreshEnabled={props?.tableRefreshEnabled}
      />
    );

    return { renderResult, mocks: { onSearch, onSandwich } };
  };

  it('should render correctly', async () => {
    mockTableSize();

    setup();

    // Columns: an actions column followed by Symbol / Self / Total.
    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(4);
    // The actions column sets hideHeader: true - its label should be blank, not the literal text "actions".
    expect(columnHeaders[0].textContent).toEqual('');
    expect(columnHeaders[1].textContent).toEqual('Symbol');
    expect(columnHeaders[2].textContent).toEqual('Self');
    expect(columnHeaders[3].textContent).toEqual('Total');

    // Sample rows render with their (unique) symbol names + self/total values. Content-based assertions since
    // react-data-grid's virtualized role="grid" doesn't have the same fixed row/cell counts as TableRT.
    expect(screen.getByText('net/http.HandlerFunc.ServeHTTP')).toBeInTheDocument();
    expect(screen.getByText('net/http.(*conn).serve')).toBeInTheDocument();
    expect(screen.getAllByText('31.7 K').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5.58 Bil').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5.63 K').length).toBeGreaterThan(0);
  });

  // The refreshed header lifts the sort arrow out of the label button so a long title can ellipsize
  // without clipping it. Asserting the arrow's placement is the observable proof that
  // tableRefreshEnabled actually reaches TableNG, since this package can't read the toggle itself.
  it.each([
    { tableRefreshEnabled: undefined, placement: 'inside' },
    { tableRefreshEnabled: true, placement: 'outside' },
  ])(
    'with tableRefreshEnabled=$tableRefreshEnabled renders the sort arrow $placement the header label',
    async ({ tableRefreshEnabled }) => {
      mockTableSize();

      setup({ tableRefreshEnabled });

      // The top table sorts by Self descending by default, so that header owns the arrow.
      const selfHeader = screen.getAllByRole('columnheader')[2];
      const label = selfHeader.querySelector('button');

      expect(selfHeader.querySelectorAll('svg')).toHaveLength(1);
      expect(label!.querySelectorAll('svg')).toHaveLength(tableRefreshEnabled ? 0 : 1);
    }
  );

  it('should render search and sandwich buttons', async () => {
    // Needed for AutoSizer to work in test
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 500,
        height: 500,
        left: 0,
      })),
    });

    const { mocks } = setup();

    const searchButtons = screen.getAllByLabelText(/Search for symbol/);
    expect(searchButtons.length > 0).toBeTruthy();
    await userEvents.click(searchButtons[0]);

    expect(mocks.onSearch).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');

    const sandwichButtons = screen.getAllByLabelText(/Show in sandwich view/);
    expect(sandwichButtons.length > 0).toBeTruthy();
    await userEvents.click(sandwichButtons[0]);

    expect(mocks.onSandwich).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');
  });

  it('should sort by column header and call onTableSort', async () => {
    mockTableSize();
    const onTableSort = jest.fn();
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });

    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        onTableSort={onTableSort}
        colorScheme={ColorScheme.ValueBased}
        useTableNG={true}
      />
    );

    const totalHeader = screen.getByRole('columnheader', { name: 'Total' });
    await userEvents.click(totalHeader);

    // First click on a column that isn't already sorted sorts ascending.
    expect(onTableSort).toHaveBeenCalledWith('Total_asc');
  });

  it('does not sort when the actions column header is clicked', async () => {
    mockTableSize();
    const onTableSort = jest.fn();
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });

    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        onTableSort={onTableSort}
        colorScheme={ColorScheme.ValueBased}
        useTableNG={true}
      />
    );

    // The actions column sets sortable: false and has a blank header (hideHeader), so it's the first
    // columnheader with no accessible name.
    const actionsHeader = screen.getAllByRole('columnheader')[0];
    await userEvents.click(actionsHeader);

    expect(onTableSort).not.toHaveBeenCalled();
  });
});

describe('buildFilteredTable', () => {
  it('should group data by label and sum values', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const result = buildFilteredTable(container!);

    expect(result.table).toEqual({
      '0': { self: 1, total: 7, totalRight: 0 },
      '1': { self: 0, total: 3, totalRight: 0 },
      '2': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 3, total: 3, totalRight: 0 },
      '4': { self: 3, total: 3, totalRight: 0 },
    });
    expect(result.otherEntry).toBeUndefined();
  });

  it('should sum values for duplicate labels', () => {
    const container = textToDataContainer(`
[0///]
[1][1]
    `);

    const result = buildFilteredTable(container!);

    expect(result.table).toEqual({
      '0': { self: 0, total: 6, totalRight: 0 },
      '1': { self: 6, total: 6, totalRight: 0 },
    });
  });

  it('should filter by matchedLabels when provided', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set(['1', '3']);
    const result = buildFilteredTable(container!, matchedLabels);

    expect(result.table).toEqual({
      '1': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 3, total: 3, totalRight: 0 },
    });
  });

  it('should handle empty matchedLabels set', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set<string>();
    const result = buildFilteredTable(container!, matchedLabels);

    expect(result.table).toEqual({});
  });

  it('should handle data with no matches', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set(['9']);
    const result = buildFilteredTable(container!, matchedLabels);

    expect(result.table).toEqual({});
  });

  it('should work without matchedLabels filter', () => {
    const container = textToDataContainer(`
[0]
[1]
    `);

    const result = buildFilteredTable(container!);

    expect(result.table).toEqual({
      '0': { self: 0, total: 3, totalRight: 0 },
      '1': { self: 3, total: 3, totalRight: 0 },
    });
  });
  it('should not inflate totals for recursive calls', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
[0]
    `);

    const result = buildFilteredTable(container!);

    expect(result.table).toEqual({
      '0': { self: 4, total: 7, totalRight: 0 },
      '1': { self: 0, total: 3, totalRight: 0 },
      '2': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 0, total: 3, totalRight: 0 },
      '4': { self: 3, total: 3, totalRight: 0 },
    });
  });

  describe('with "other" data', () => {
    // A minimal flame graph whose "other" node aggregates the truncated part: self and total are both 3, while
    // the smallest node in the whole graph (lib, total: 2) is the truncation threshold.
    const dataWithOther = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10, 5, 3, 2] },
        { name: 'self', values: [0, 5, 3, 2] },
        { name: 'label', values: ['total', 'app', 'other', 'lib'] },
      ],
    });
    const containerWithOther = () => new FlameGraphDataContainer(dataWithOther, { collapsing: true });

    it('should extract "other" into otherEntry instead of a table row', () => {
      const result = buildFilteredTable(containerWithOther());

      // The root node stays a regular row; only "other" is pulled out.
      expect(result.table).toEqual({
        total: { self: 0, total: 10, totalRight: 0 },
        app: { self: 5, total: 5, totalRight: 0 },
        lib: { self: 2, total: 2, totalRight: 0 },
      });
      expect(result.otherEntry).toEqual({ self: 3, total: 3, totalRight: 0 });
    });

    it('should respect matchedLabels for the "other" entry', () => {
      // When the "other" node itself doesn't match the active search, it's not surfaced at all.
      const filteredOut = buildFilteredTable(containerWithOther(), new Set(['app']));
      expect(filteredOut.table).toEqual({ app: { self: 5, total: 5, totalRight: 0 } });
      expect(filteredOut.otherEntry).toBeUndefined();

      // When it does match, it's still not a table row but is returned separately.
      const matched = buildFilteredTable(containerWithOther(), new Set(['other']));
      expect(matched.table).toEqual({});
      expect(matched.otherEntry).toEqual({ self: 3, total: 3, totalRight: 0 });
    });
  });
});

describe('FlameGraphTopTableContainer column widths with useTableNG', () => {
  const GRID_WIDTH = 500;
  const SCROLLBAR_WIDTH = 11;

  // jsdom does no layout, so the grid's own vertical scrollbar has to be faked: TableNG derives it
  // from offsetWidth - clientWidth on the grid element and lays the columns out inside what is left.
  // Without it the space available to the columns always equals the width the table is handed, and a
  // set of column widths that overflows by exactly the scrollbar looks fine.
  const mockedSizes = [
    { property: 'offsetWidth', target: HTMLElement.prototype, gridValue: GRID_WIDTH },
    { property: 'clientWidth', target: Element.prototype, gridValue: GRID_WIDTH - SCROLLBAR_WIDTH },
  ] as const;

  const originalDescriptors = mockedSizes.map(({ property, target }) => ({
    property,
    target,
    descriptor: Object.getOwnPropertyDescriptor(target, property)!,
  }));

  const mockGridScrollbar = () => {
    for (const { property, target, gridValue } of mockedSizes) {
      Object.defineProperty(target, property, {
        configurable: true,
        get(this: Element) {
          return this.classList.contains('rdg') ? gridValue : 0;
        },
      });
    }
  };

  afterEach(() => {
    for (const { property, target, descriptor } of originalDescriptors) {
      Object.defineProperty(target, property, descriptor);
    }
  });

  it('fits the columns in the space the scrollbar leaves rather than the full width', async () => {
    mockTableSize({ width: GRID_WIDTH, height: GRID_WIDTH });
    mockGridScrollbar();

    const container = new FlameGraphDataContainer(createDataFrame(data), { collapsing: true });
    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        colorScheme={ColorScheme.ValueBased}
        useTableNG={true}
      />
    );

    await waitFor(() => {
      const grid = document.querySelector<HTMLElement>('.rdg')!;
      // The wrapper the TableNG branch sizes, i.e. the width the table was handed.
      const handedWidth = parseFloat(grid.parentElement!.style.width);
      const columnWidths = grid.style.gridTemplateColumns.split(' ').map(parseFloat);

      expect(columnWidths).toHaveLength(4);
      expect(columnWidths.reduce((total, columnWidth) => total + columnWidth, 0)).toBe(handedWidth - SCROLLBAR_WIDTH);
    });
  });
});
