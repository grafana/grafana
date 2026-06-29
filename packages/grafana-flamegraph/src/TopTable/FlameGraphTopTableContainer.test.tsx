import { render, screen } from '@testing-library/react';
import userEvents from '@testing-library/user-event';

import { createDataFrame } from '@grafana/data';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';
import { textToDataContainer } from '../FlameGraph/testHelpers';
import { ColorScheme } from '../types';

import FlameGraphTopTableContainer, { buildFilteredTable } from './FlameGraphTopTableContainer';

describe('FlameGraphTopTableContainer', () => {
  const setup = () => {
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
        enableVirtualization={false}
      />
    );

    return { renderResult, mocks: { onSearch, onSandwich } };
  };

  it('should render correctly', async () => {
    // Needed for AutoSizer to work in test
    mockBoundingClientRect({ width: 500, height: 500 });

    setup();

    // Columns: an actions column followed by Symbol / Self / Total.
    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(4);
    expect(columnHeaders[1].textContent).toEqual('Symbol');
    expect(columnHeaders[2].textContent).toEqual('Self');
    expect(columnHeaders[3].textContent).toEqual('Total');

    // Sample rows render with their (unique) symbol names + self/total values.
    expect(screen.getByText('net/http.HandlerFunc.ServeHTTP')).toBeInTheDocument();
    expect(screen.getByText('net/http.(*conn).serve')).toBeInTheDocument();
    expect(screen.getAllByText('total').length).toBeGreaterThan(0);
    expect(screen.getAllByText('31.7 K').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5.58 Bil').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5.63 K').length).toBeGreaterThan(0);
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
