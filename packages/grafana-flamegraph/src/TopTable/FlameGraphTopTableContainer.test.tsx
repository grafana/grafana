import { render, screen } from '@testing-library/react';
import userEvents from '@testing-library/user-event';

import { createDataFrame, FieldType } from '@grafana/data';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';
import { textToDataContainer } from '../FlameGraph/testHelpers';
import { ColorScheme } from '../types';

import FlameGraphTopTableContainer, { buildFilteredTable } from './FlameGraphTopTableContainer';

function createTestDataWithOther() {
  return new FlameGraphDataContainer(
    createDataFrame({
      fields: [
        { name: 'level', type: FieldType.number, values: [0, 1, 2, 1, 2] },
        { name: 'value', type: FieldType.number, values: [100, 50, 30, 50, 20] },
        { name: 'self', type: FieldType.number, values: [0, 20, 30, 30, 20] },
        { name: 'label', type: FieldType.string, values: ['root', 'func1', 'func2', 'other', 'func3'] },
      ],
    }),
    { collapsing: false }
  );
}

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
});

describe('buildFilteredTable', () => {
  it('should group data by label and sum values', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const { table, otherData } = buildFilteredTable(container!);

    expect(table).toEqual({
      '0': { self: 1, total: 7, totalRight: 0 },
      '1': { self: 0, total: 3, totalRight: 0 },
      '2': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 3, total: 3, totalRight: 0 },
      '4': { self: 3, total: 3, totalRight: 0 },
    });
    expect(otherData).toBeUndefined();
  });

  it('should sum values for duplicate labels', () => {
    const container = textToDataContainer(`
[0///]
[1][1]
    `);

    const { table, otherData } = buildFilteredTable(container!);

    expect(table).toEqual({
      '0': { self: 0, total: 6, totalRight: 0 },
      '1': { self: 6, total: 6, totalRight: 0 },
    });
    expect(otherData).toBeUndefined();
  });

  it('should filter by matchedLabels when provided', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set(['1', '3']);
    const { table, otherData } = buildFilteredTable(container!, matchedLabels);

    expect(table).toEqual({
      '1': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 3, total: 3, totalRight: 0 },
    });
    expect(otherData).toBeUndefined();
  });

  it('should handle empty matchedLabels set', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set<string>();
    const { table } = buildFilteredTable(container!, matchedLabels);

    expect(table).toEqual({});
  });

  it('should handle data with no matches', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set(['9']);
    const { table } = buildFilteredTable(container!, matchedLabels);

    expect(table).toEqual({});
  });

  it('should work without matchedLabels filter', () => {
    const container = textToDataContainer(`
[0]
[1]
    `);

    const { table, otherData } = buildFilteredTable(container!);

    expect(table).toEqual({
      '0': { self: 0, total: 3, totalRight: 0 },
      '1': { self: 3, total: 3, totalRight: 0 },
    });
    expect(otherData).toBeUndefined();
  });
  it('should not inflate totals for recursive calls', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
[0]
    `);

    const { table, otherData } = buildFilteredTable(container!);

    expect(table).toEqual({
      '0': { self: 4, total: 7, totalRight: 0 },
      '1': { self: 0, total: 3, totalRight: 0 },
      '2': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 0, total: 3, totalRight: 0 },
      '4': { self: 3, total: 3, totalRight: 0 },
    });
    expect(otherData).toBeUndefined();
  });

  it('should extract "other" label from table and return it separately', () => {
    const container = createTestDataWithOther();

    const { table, otherData } = buildFilteredTable(container);

    expect(table['root']).toBeDefined();
    expect(table['func1']).toBeDefined();
    expect(table['func2']).toBeDefined();
    expect(table['func3']).toBeDefined();
    expect(table['other']).toBeUndefined();
    expect(otherData).toBeDefined();
    expect(otherData?.self).toBe(30);
    expect(otherData?.total).toBe(50);
  });
});

describe('FlameGraphTopTableContainer with other', () => {
  it('should render other section when data contains other label', async () => {
    mockBoundingClientRect({ width: 500, height: 500 });
    const container = createTestDataWithOther();

    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        colorScheme={ColorScheme.ValueBased}
      />
    );

    const otherSection = screen.getByTestId('other-section');
    expect(otherSection).toBeInTheDocument();
    expect(otherSection.textContent).toContain('truncated');
    expect(otherSection.textContent).toContain('other');
  });
});
