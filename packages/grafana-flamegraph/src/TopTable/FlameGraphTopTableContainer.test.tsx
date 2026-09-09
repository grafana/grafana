import { render, screen, within } from '@testing-library/react';
import userEvents from '@testing-library/user-event';

import { createDataFrame } from '@grafana/data';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';
import { textToDataContainer } from '../FlameGraph/testHelpers';
import { ColorScheme, ColorSchemeDiff } from '../types';

import FlameGraphTopTableContainer, { buildFilteredTable } from './FlameGraphTopTableContainer';

describe('FlameGraphTopTableContainer', () => {
  const setup = (flameGraphInput = data, colorScheme: ColorScheme | ColorSchemeDiff = ColorScheme.ValueBased) => {
    const flameGraphData = createDataFrame(flameGraphInput);
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });
    const onSearch = jest.fn();
    const onSandwich = jest.fn();

    const renderResult = render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={onSearch}
        onSandwich={onSandwich}
        colorScheme={colorScheme}
      />
    );

    return { renderResult, mocks: { onSearch, onSandwich } };
  };

  it('should render correctly', async () => {
    // Needed for AutoSizer to work in test
    mockBoundingClientRect({ width: 500, height: 500 });

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

  it('renders the other aggregate below the table with its actions', async () => {
    mockBoundingClientRect({ width: 500, height: 500 });
    const flameGraphWithOther = {
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10, 4, 3, 3] },
        { name: 'self', values: [0, 4, 3, 3] },
        { name: 'label', values: ['total', 'foo', 'bar', 'other'] },
      ],
    };

    const { mocks } = setup(flameGraphWithOther);
    const summary = screen.getByTestId('topTableOtherSummary');

    expect(screen.queryByRole('cell', { name: 'other' })).not.toBeInTheDocument();
    expect(summary).toHaveTextContent(
      'A total of 3 was truncated and is represented by other in the flame graph. The smallest included stack trace has a total resource consumption of 3.'
    );

    await userEvents.click(within(summary).getByLabelText('Search for symbol'));
    expect(mocks.onSearch).toHaveBeenCalledWith('other');

    await userEvents.click(within(summary).getByLabelText('Show in sandwich view'));
    expect(mocks.onSandwich).toHaveBeenCalledWith('other');
  });

  it('renders baseline, comparison, and difference totals for a diff flame graph', () => {
    mockBoundingClientRect({ width: 500, height: 500 });
    const diffFlameGraphWithOther = {
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10, 4, 3, 3] },
        { name: 'self', values: [0, 4, 3, 3] },
        { name: 'valueRight', values: [20, 6, 6, 8] },
        { name: 'selfRight', values: [0, 6, 6, 8] },
        { name: 'label', values: ['total', 'foo', 'bar', 'other'] },
      ],
    };

    setup(diffFlameGraphWithOther, ColorSchemeDiff.Default);

    expect(screen.getByTestId('topTableOtherSummary')).toHaveTextContent(
      'Truncated totals represented by other in the flame graph: baseline 3, comparison 8, difference 5. The smallest included stack trace has a baseline total resource consumption of 3.'
    );
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

    expect(result).toEqual({
      '0': { self: 1, total: 7, totalRight: 0 },
      '1': { self: 0, total: 3, totalRight: 0 },
      '2': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 3, total: 3, totalRight: 0 },
      '4': { self: 3, total: 3, totalRight: 0 },
    });
  });

  it('should sum values for duplicate labels', () => {
    const container = textToDataContainer(`
[0///]
[1][1]
    `);

    const result = buildFilteredTable(container!);

    expect(result).toEqual({
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

    expect(result).toEqual({
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

    expect(result).toEqual({});
  });

  it('should handle data with no matches', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set(['9']);
    const result = buildFilteredTable(container!, matchedLabels);

    expect(result).toEqual({});
  });

  it('should work without matchedLabels filter', () => {
    const container = textToDataContainer(`
[0]
[1]
    `);

    const result = buildFilteredTable(container!);

    expect(result).toEqual({
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

    expect(result).toEqual({
      '0': { self: 4, total: 7, totalRight: 0 },
      '1': { self: 0, total: 3, totalRight: 0 },
      '2': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 0, total: 3, totalRight: 0 },
      '4': { self: 3, total: 3, totalRight: 0 },
    });
  });
});
