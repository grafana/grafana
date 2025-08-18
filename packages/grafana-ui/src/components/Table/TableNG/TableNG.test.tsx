import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  createTheme,
  DataFrame,
  DataLink,
  EventBus,
  FieldType,
  LinkModel,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TableCellBackgroundDisplayMode } from '@grafana/schema';

import { PanelContext, PanelContextProvider } from '../../../components/PanelChrome';
import { TableCellDisplayMode } from '../types';

import { TableNG } from './TableNG';

// Create a basic data frame for testing
const createBasicDataFrame = (): DataFrame => {
  const frame = toDataFrame({
    name: 'TestData',
    length: 3,
    fields: [
      {
        name: 'Column A',
        type: FieldType.string,
        values: ['A1', 'A2', 'A3'],
        config: {
          custom: {
            width: 150,
            cellOptions: {
              type: TableCellDisplayMode.Auto,
              wrapText: false,
            },
          },
        },
        // Add display function
        display: (value: unknown) => ({
          text: String(value),
          numeric: 0,
          color: undefined,
          prefix: undefined,
          suffix: undefined,
        }),
        // Add state and getLinks
        state: {},
        getLinks: () => [],
      },
      {
        name: 'Column B',
        type: FieldType.number,
        values: [1, 2, 3],
        config: {
          custom: {
            width: 150,
            cellOptions: {
              type: TableCellDisplayMode.Auto,
              wrapText: false,
            },
          },
        },
        // Add display function
        display: (value: unknown) => ({
          text: String(value),
          numeric: Number(value),
          color: undefined,
          prefix: undefined,
          suffix: undefined,
        }),
        // Add state and getLinks
        state: {},
        getLinks: () => [],
      },
    ],
  });

  // The applyFieldOverrides should add display processors, but we'll keep our explicit ones too
  return applyFieldOverrides({
    data: [frame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];
};

// Create a nested data frame for testing expandable rows
const createNestedDataFrame = (): DataFrame => {
  const nestedFrame = toDataFrame({
    name: 'NestedData',
    fields: [
      {
        name: 'Nested A',
        type: FieldType.string,
        values: ['N1', 'N2'],
        config: { custom: {} },
      },
      {
        name: 'Nested B',
        type: FieldType.number,
        values: [10, 20],
        config: { custom: {} },
      },
    ],
  });

  const processedNestedFrame = applyFieldOverrides({
    data: [nestedFrame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];

  const frame = toDataFrame({
    name: 'TestData',
    length: 2,
    fields: [
      {
        name: 'Column A',
        type: FieldType.string,
        values: ['A1', 'A2'],
        config: { custom: {} },
      },
      {
        name: 'Column B',
        type: FieldType.number,
        values: [1, 2],
        config: { custom: {} },
      },
      // Add special fields for nested table functionality
      {
        name: '__depth',
        type: FieldType.number,
        values: [0, 0],
        config: { custom: { hidden: true } },
      },
      {
        name: '__index',
        type: FieldType.number,
        values: [0, 1],
        config: { custom: { hidden: true } },
      },
      {
        name: '__nestedFrames',
        type: FieldType.nestedFrames,
        values: [[processedNestedFrame], [processedNestedFrame]],
        config: { custom: {} },
      },
    ],
  });

  return applyFieldOverrides({
    data: [frame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];
};

// Create a data frame specifically for testing multi-column sorting
const createSortingTestDataFrame = (): DataFrame => {
  const frame = toDataFrame({
    name: 'SortingTestData',
    length: 5,
    fields: [
      {
        name: 'Category',
        type: FieldType.string,
        values: ['A', 'B', 'A', 'B', 'A'],
        config: {
          custom: {
            width: 150,
            cellOptions: {
              type: TableCellDisplayMode.Auto,
              wrapText: false,
            },
          },
        },
        display: (value: unknown) => ({
          text: String(value),
          numeric: 0,
          color: undefined,
          prefix: undefined,
          suffix: undefined,
        }),
        state: {},
        getLinks: () => [],
      },
      {
        name: 'Value',
        type: FieldType.number,
        values: [5, 3, 1, 4, 2],
        config: {
          custom: {
            width: 150,
            cellOptions: {
              type: TableCellDisplayMode.Auto,
              wrapText: false,
            },
          },
        },
        display: (value: unknown) => ({
          text: String(value),
          numeric: Number(value),
          color: undefined,
          prefix: undefined,
          suffix: undefined,
        }),
        state: {},
        getLinks: () => [],
      },
      {
        name: 'Name',
        type: FieldType.string,
        values: ['John', 'Jane', 'Bob', 'Alice', 'Charlie'],
        config: {
          custom: {
            width: 150,
            cellOptions: {
              type: TableCellDisplayMode.Auto,
              wrapText: false,
            },
          },
        },
        display: (value: unknown) => ({
          text: String(value),
          numeric: 0,
          color: undefined,
          prefix: undefined,
          suffix: undefined,
        }),
        state: {},
        getLinks: () => [],
      },
    ],
  });

  return applyFieldOverrides({
    data: [frame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];
};

const createTimeDataFrame = (): DataFrame => {
  const frame = toDataFrame({
    name: 'TimeTestData',
    length: 3,
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        values: [
          new Date('2024-03-20T10:00:00Z').getTime(),
          new Date('2024-03-20T10:01:00Z').getTime(),
          new Date('2024-03-20T10:02:00Z').getTime(),
        ],
        config: { custom: {} },
      },
      {
        name: 'Value',
        type: FieldType.number,
        values: [1, 2, 3],
        config: { custom: {} },
      },
    ],
  });

  return applyFieldOverrides({
    data: [frame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];
};

describe('TableNG', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let origResizeObserver = global.ResizeObserver;
  let origScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    user = userEvent.setup();
    origResizeObserver = global.ResizeObserver;
    origScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      constructor(callback: any) {
        // Store the callback
        this.callback = callback;
      }
      callback: any;
      observe() {
        // Do nothing
      }
      unobserve() {
        // Do nothing
      }
      disconnect() {
        // Do nothing
      }
    };

    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    global.ResizeObserver = origResizeObserver;
    window.HTMLElement.prototype.scrollIntoView = origScrollIntoView;
  });

  describe('Basic TableNG rendering', () => {
    it('renders a simple table with columns and rows', async () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
      );

      // Check for the data grid container
      const dataGridContainer = container.querySelector('[role="grid"]');
      expect(dataGridContainer).toBeInTheDocument();

      // Check for column headers
      const headers = container.querySelectorAll('[role="columnheader"]');
      expect(headers.length).toBe(2);

      // Check for cell values
      const cells = container.querySelectorAll('[role="gridcell"]');
      expect(cells.length).toBe(6); // 3 rows x 2 columns

      // Check for specific text content
      const expectedContent = ['Column A', 'Column B', 'A1', 'A2', 'A3', '1', '2', '3'];
      expectedContent.forEach((text) => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });
    });
  });

  describe('Nested tables', () => {
    it('renders table with nested data structure', () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createNestedDataFrame()} width={800} height={600} />
      );

      const expectedContent = ['Column A', 'Column B', 'A1', 'A2'];
      expectedContent.forEach((text) => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });

      const grid = container.querySelector('[role="grid"]');
      expect(grid).toBeInTheDocument();

      const expandIcons = container.querySelectorAll('svg[aria-label="Expand row"]');
      expect(expandIcons.length).toBeGreaterThan(0);
    });

    it('expands nested data when clicking expand button', async () => {
      // Mock scrollIntoView
      window.HTMLElement.prototype.scrollIntoView = jest.fn();

      const { container } = render(
        <TableNG enableVirtualization={false} data={createNestedDataFrame()} width={800} height={600} />
      );

      // Verify initial state
      const expectedContent = ['Column A', 'Column B', 'A1', 'A2'];
      expectedContent.forEach((text) => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });

      // Count initial rows
      const initialRows = container.querySelectorAll('[role="row"]');
      const initialRowCount = initialRows.length;

      // Find the expand button
      const expandButton = container.querySelector('svg[aria-label="Expand row"]');
      expect(expandButton).toBeInTheDocument();

      // Click the expand button
      if (expandButton) {
        await user.click(expandButton);

        // After expansion, we should have more rows
        const expandedRows = container.querySelectorAll('[role="row"]');
        expect(expandedRows.length).toBeGreaterThan(initialRowCount);

        // Check for nested data by looking for specific cell content
        const expectedExpandedContent = ['N1', 'N2'];
        expectedExpandedContent.forEach((text) => {
          expect(screen.getByText(text)).toBeInTheDocument();
        });

        // Check if the expanded row has the aria-expanded attribute
        const expandedRow = container.querySelector('[aria-expanded="true"]');
        expect(expandedRow).toBeInTheDocument();
      }
    });
  });

  describe('Header options', () => {
    it('defaults to showing headers', () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
      );

      // Check for column headers
      const headers = container.querySelectorAll('[role="columnheader"]');
      expect(headers.length).toBe(2);
    });

    it('hides headers when noHeader is true', () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} noHeader={true} />
      );

      // Get the grid container
      const gridContainer = container.querySelector('[role="grid"]');
      expect(gridContainer).toBeInTheDocument();

      if (gridContainer) {
        // Check that the --rdg-header-row-height CSS variable is set to 0px
        const computedStyle = window.getComputedStyle(gridContainer);
        const headerRowHeight = computedStyle.getPropertyValue('--rdg-header-row-height');
        expect(headerRowHeight).toBe('0px');
      }

      // Cell values should still be visible
      expect(screen.getByText('A1')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Footer options', () => {
    it('defaults to not showing footer', () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
      );
      expect(container.querySelector('.rdg-summary-row')).not.toBeInTheDocument();
    });

    it('renders footer with aggregations when footerOptions are provided', () => {
      const { container } = render(
        <TableNG
          enableVirtualization={false}
          data={createBasicDataFrame()}
          width={800}
          height={600}
          footerOptions={{
            show: true,
            reducer: ['sum'],
            countRows: false,
          }}
        />
      );

      // Check for footer row
      const footerRow = container.querySelector('.rdg-summary-row');
      expect(footerRow).toBeInTheDocument();

      // Sum of Column B values (1+2+3=6)
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('renders row count in footer when countRows is true', () => {
      const { container } = render(
        <TableNG
          enableVirtualization={false}
          data={createBasicDataFrame()}
          width={800}
          height={600}
          footerOptions={{
            show: true,
            reducer: ['count'],
            countRows: true, // Enable row counting
          }}
        />
      );

      // Check for footer row
      const footerRow = container.querySelector('.rdg-summary-row');
      expect(footerRow).toBeInTheDocument();

      // Get the text content of the footer cells
      const footerCells = footerRow?.querySelectorAll('[role="gridcell"]');
      const footerTexts = Array.from(footerCells || []).map((cell) => cell.textContent);

      // The first cell should contain the row count (3 rows)
      expect(footerTexts[0]).toBe('Count3');

      // There should be no other footer cells
      expect(footerTexts[1]).toBe('');
    });
  });

  describe('Pagination', () => {
    it('defaults to not showing pagination', () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
      );
      expect(container.querySelector('.table-ng-pagination')).not.toBeInTheDocument();
    });

    it('shows pagination controls when enabled', () => {
      // Create a data frame with many rows
      const fields = [
        {
          name: 'Index',
          type: FieldType.number,
          values: Array.from({ length: 100 }, (_, i) => i),
          config: { custom: {} },
        },
        {
          name: 'Value',
          type: FieldType.string,
          values: Array.from({ length: 100 }, (_, i) => `Value ${i}`),
          config: { custom: {} },
        },
      ];

      const largeFrame = toDataFrame({ name: 'LargeData', fields });
      const processedFrame = applyFieldOverrides({
        data: [largeFrame],
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
        replaceVariables: (value) => value,
        timeZone: 'utc',
        theme: createTheme(),
      })[0];

      const { container } = render(
        <TableNG
          data={processedFrame}
          width={800}
          height={300} // Small height to force pagination
          enablePagination={true}
        />
      );

      // Check for pagination controls using the specific class name
      const pagination = container.querySelector('.table-ng-pagination');
      expect(pagination).toBeInTheDocument();

      // Verify that pagination summary text is shown
      const paginationText = container.textContent;
      expect(paginationText).toContain('of 100 rows');
    });

    it('navigates between pages when pagination controls are clicked', async () => {
      // Create a data frame with many rows
      const fields = [
        {
          name: 'Index',
          type: FieldType.number,
          values: Array.from({ length: 100 }, (_, i) => i),
          config: { custom: {} },
          display: (v: number) => ({ text: String(v), numeric: Number(v) }),
        },
        {
          name: 'Value',
          type: FieldType.string,
          values: Array.from({ length: 100 }, (_, i) => `Value ${i}`),
          config: { custom: {} },
          display: (v: string) => ({ text: String(v), numeric: 0 }),
        },
      ];

      const largeFrame = toDataFrame({ name: 'LargeData', fields });
      const processedFrame = applyFieldOverrides({
        data: [largeFrame],
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
        replaceVariables: (value) => value,
        timeZone: 'utc',
        theme: createTheme(),
      })[0];

      const { container } = render(
        <TableNG
          data={processedFrame}
          width={800}
          height={300} // Small height to force pagination
          enablePagination={true}
        />
      );

      // Get all cell content on the first page
      const initialCells = container.querySelectorAll('[role="gridcell"]');
      const initialCellTexts = Array.from(initialCells).map((cell) => cell.textContent);

      // Store the first page's first visible row index
      const firstPageFirstIndex = initialCellTexts[0];

      // Store the first page content for comparison
      const firstPageContent = container.textContent || '';

      // Find and click next page button
      const nextButton = container.querySelector('[aria-label="next page" i], [aria-label*="Next" i]');
      expect(nextButton).toBeInTheDocument();

      if (nextButton) {
        // Click to go to the next page
        await user.click(nextButton);

        // Get all cell content on the second page
        const newCells = container.querySelectorAll('[role="gridcell"]');
        const newCellTexts = Array.from(newCells).map((cell) => cell.textContent);

        // The first cell on the second page should be different from the first page
        const secondPageFirstIndex = newCellTexts[0];
        expect(secondPageFirstIndex).not.toBe(firstPageFirstIndex);

        // The content should have changed
        const secondPageContent = container.textContent || '';
        expect(secondPageContent).not.toBe(firstPageContent);

        // Check that the pagination summary shows we're on a different page
        // The format appears to be "X - Y of Z rows" where X and Y are the row range
        expect(container).toHaveTextContent(/\d+ - \d+ of 100 rows/);

        // Verify that the pagination summary has changed
        const paginationSummary = container.querySelector('.paginationSummary, [class*="paginationSummary"]');
        if (paginationSummary) {
          const summaryText = paginationSummary.textContent || '';
          expect(summaryText).toContain('of 100 rows');
        } else {
          // If we can't find the pagination summary by class, just check the container text
          expect(container).toHaveTextContent(/of 100 rows/);
        }
      }
    });
  });

  describe('Sorting', () => {
    it('allows sorting when clicking on column headers', async () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
      );

      // Ensure there are column headers
      const columnHeader = container.querySelector('[role="columnheader"]');
      expect(columnHeader).toBeInTheDocument();

      // Find the sort button within the first header
      if (!columnHeader) {
        throw new Error('No column header found');
      }

      // Store the initial state of the header
      const initialSortAttribute = columnHeader.getAttribute('aria-sort');

      // Look for a button inside the header
      const sortButton = columnHeader.querySelector('button') || columnHeader;

      // Click the sort button
      await user.click(sortButton);

      // After clicking, the header should have an aria-sort attribute
      const newSortAttribute = columnHeader.getAttribute('aria-sort');

      // The sort attribute should have changed
      expect(newSortAttribute).not.toBe(initialSortAttribute);

      // The sort attribute should be either 'ascending' or 'descending'
      expect(['ascending', 'descending']).toContain(newSortAttribute);

      // Also verify the data is sorted by checking cell values
      const cells = container.querySelectorAll('[role="gridcell"]');
      const firstColumnCells = Array.from(cells).filter((_, index) => index % 2 === 0);

      // Get the text content of the first column cells
      const cellValues = firstColumnCells.map((cell) => cell.textContent);

      // Verify we have values to check
      expect(cellValues.length).toBeGreaterThan(0);

      // Verify the values are in sorted order based on the aria-sort attribute
      const sortedValues = [...cellValues].sort();

      if (newSortAttribute === 'ascending') {
        expect(JSON.stringify(cellValues)).toBe(JSON.stringify(sortedValues));
      } else if (newSortAttribute === 'descending') {
        expect(JSON.stringify(cellValues)).toBe(JSON.stringify([...sortedValues].reverse()));
      }
    });

    it('cycles through ascending, descending, and no sort states', async () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
      );

      // Get the first column header
      const columnHeader = container.querySelector('[role="columnheader"]');
      expect(columnHeader).toBeInTheDocument();

      if (columnHeader) {
        const sortButton = columnHeader.querySelector('button') || columnHeader;

        // Initial state - no sort
        expect(columnHeader).not.toHaveAttribute('aria-sort');

        // First click - should sort ascending
        await user.click(sortButton);
        expect(columnHeader).toHaveAttribute('aria-sort', 'ascending');

        // Second click - should sort descending
        await user.click(sortButton);
        expect(columnHeader).toHaveAttribute('aria-sort', 'descending');

        // Third click - should remove sort
        await user.click(sortButton);
        expect(columnHeader).not.toHaveAttribute('aria-sort');
      }
    });

    it('supports multi-column sorting with cmd or ctrl key', async () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createSortingTestDataFrame()} width={800} height={600} />
      );

      // Get all column headers
      const columnHeaders = container.querySelectorAll('[role="columnheader"]');
      expect(columnHeaders.length).toBe(3); // Category, Value, Name

      // Extract text from all cells before sorting
      const getCellTextContent = () => {
        const cells = container.querySelectorAll('[role="gridcell"]');
        const rows: string[][] = [];
        let currentRow: string[] = [];

        // Group cells into rows (3 cells per row)
        Array.from(cells).forEach((cell, index) => {
          currentRow.push(cell.textContent || '');
          if ((index + 1) % 3 === 0) {
            rows.push([...currentRow]);
            currentRow = [];
          }
        });

        return rows;
      };

      // Initial unsorted data
      const initialRows = getCellTextContent();
      expect(initialRows.length).toBe(5);

      // Log the initial unsorted data order for reference
      // The data should be in the original order:
      // ['A', '5', 'John'], ['B', '3', 'Jane'], ['A', '1', 'Bob'], ['B', '4', 'Alice'], ['A', '2', 'Charlie']
      expect(initialRows[0][0]).toBe('A');
      expect(initialRows[0][1]).toBe('5');
      expect(initialRows[0][2]).toBe('John');

      expect(initialRows[1][0]).toBe('B');
      expect(initialRows[1][1]).toBe('3');
      expect(initialRows[1][2]).toBe('Jane');

      expect(initialRows[2][0]).toBe('A');
      expect(initialRows[2][1]).toBe('1');
      expect(initialRows[2][2]).toBe('Bob');

      expect(initialRows[3][0]).toBe('B');
      expect(initialRows[3][1]).toBe('4');
      expect(initialRows[3][2]).toBe('Alice');

      expect(initialRows[4][0]).toBe('A');
      expect(initialRows[4][1]).toBe('2');
      expect(initialRows[4][2]).toBe('Charlie');

      // First column button (Category)
      const categoryColumnButton = columnHeaders[0].querySelector('button') || columnHeaders[0];
      // Second column button (Value)
      const valueColumnButton = columnHeaders[1].querySelector('button') || columnHeaders[1];

      // 1. First sort by Category (ascending)
      await user.click(categoryColumnButton);

      // Check data is sorted by Category
      const categoryOnlySortedRows = getCellTextContent();
      expect(categoryOnlySortedRows.length).toBe(5);

      // First 3 rows should be 'A' category, then 2 rows of 'B' category
      // The expected order should be:
      // A rows: (still unsorted within categories)
      // ['A', '5', 'John'], ['A', '1', 'Bob'], ['A', '2', 'Charlie']
      // B rows: (still unsorted within categories)
      // ['B', '3', 'Jane'], ['B', '4', 'Alice']

      // Check Category A rows
      expect(categoryOnlySortedRows[0][0]).toBe('A');
      expect(categoryOnlySortedRows[1][0]).toBe('A');
      expect(categoryOnlySortedRows[2][0]).toBe('A');

      // Check Category B rows
      expect(categoryOnlySortedRows[3][0]).toBe('B');
      expect(categoryOnlySortedRows[4][0]).toBe('B');

      // Find all values in Category A to check if they contain the expected values
      // (order within category may vary as we haven't sorted by Value yet)
      const categoryAValues = categoryOnlySortedRows.slice(0, 3).map((row) => row[1]);
      expect(categoryAValues).toContain('5');
      expect(categoryAValues).toContain('1');
      expect(categoryAValues).toContain('2');

      // Find all values in Category B to check if they contain the expected values
      const categoryBValues = categoryOnlySortedRows.slice(3, 5).map((row) => row[1]);
      expect(categoryBValues).toContain('3');
      expect(categoryBValues).toContain('4');

      // 2. Now add second sort column (Value) with shift key
      await user.keyboard('{Control>}');
      await user.click(valueColumnButton);

      // Check data is sorted by Category and then by Value
      const multiSortedRows = getCellTextContent();
      expect(multiSortedRows.length).toBe(5);

      // Now the rows should be perfectly ordered by Category, then by Value (ascending)
      // Expected order:
      // ['A', '1', 'Bob'], ['A', '2', 'Charlie'], ['A', '5', 'John']
      // ['B', '3', 'Jane'], ['B', '4', 'Alice']

      // Check Category A rows with ascending Value
      expect(multiSortedRows[0][0]).toBe('A');
      expect(multiSortedRows[0][1]).toBe('1');
      expect(multiSortedRows[0][2]).toBe('Bob');

      expect(multiSortedRows[1][0]).toBe('A');
      expect(multiSortedRows[1][1]).toBe('2');
      expect(multiSortedRows[1][2]).toBe('Charlie');

      expect(multiSortedRows[2][0]).toBe('A');
      expect(multiSortedRows[2][1]).toBe('5');
      expect(multiSortedRows[2][2]).toBe('John');

      // Check Category B rows with ascending Value
      expect(multiSortedRows[3][0]).toBe('B');
      expect(multiSortedRows[3][1]).toBe('3');
      expect(multiSortedRows[3][2]).toBe('Jane');

      expect(multiSortedRows[4][0]).toBe('B');
      expect(multiSortedRows[4][1]).toBe('4');
      expect(multiSortedRows[4][2]).toBe('Alice');

      // 3. Change Value sort direction to descending
      await user.click(valueColumnButton);

      // Check data is sorted by Category (asc) and then by Value (desc)
      const multiSortedRowsDesc = getCellTextContent();
      expect(multiSortedRowsDesc.length).toBe(5);

      // Now the rows should be ordered by Category, then by Value (descending)
      // Expected order:
      // ['A', '5', 'John'], ['A', '2', 'Charlie'], ['A', '1', 'Bob']
      // ['B', '4', 'Alice'], ['B', '3', 'Jane']

      // Check Category A rows with descending Value
      expect(multiSortedRowsDesc[0][0]).toBe('A');
      expect(multiSortedRowsDesc[0][1]).toBe('5');
      expect(multiSortedRowsDesc[0][2]).toBe('John');

      expect(multiSortedRowsDesc[1][0]).toBe('A');
      expect(multiSortedRowsDesc[1][1]).toBe('2');
      expect(multiSortedRowsDesc[1][2]).toBe('Charlie');

      expect(multiSortedRowsDesc[2][0]).toBe('A');
      expect(multiSortedRowsDesc[2][1]).toBe('1');
      expect(multiSortedRowsDesc[2][2]).toBe('Bob');

      // Check Category B rows with descending Value
      expect(multiSortedRowsDesc[3][0]).toBe('B');
      expect(multiSortedRowsDesc[3][1]).toBe('4');
      expect(multiSortedRowsDesc[3][2]).toBe('Alice');

      expect(multiSortedRowsDesc[4][0]).toBe('B');
      expect(multiSortedRowsDesc[4][1]).toBe('3');
      expect(multiSortedRowsDesc[4][2]).toBe('Jane');

      // 4. Test removing the secondary sort by clicking a third time
      await user.click(valueColumnButton);

      // The data should still be sorted by Category only
      const singleSortRows = getCellTextContent();

      // First 3 rows should still be 'A' category, but values might be in original order
      expect(singleSortRows[0][0]).toBe('A');
      expect(singleSortRows[1][0]).toBe('A');
      expect(singleSortRows[2][0]).toBe('A');

      // Last 2 rows should still be 'B' category
      expect(singleSortRows[3][0]).toBe('B');
      expect(singleSortRows[4][0]).toBe('B');

      // finally release control and prove that we exit multi-sort mode
      await user.keyboard('{/Control}');
      await user.click(categoryColumnButton);

      const nonMultiSortCategoryRows = getCellTextContent();

      expect(nonMultiSortCategoryRows[0][0]).toBe('B');
      expect(nonMultiSortCategoryRows[0][1]).toBe('3');
      expect(nonMultiSortCategoryRows[0][2]).toBe('Jane');

      expect(nonMultiSortCategoryRows[1][0]).toBe('B');
      expect(nonMultiSortCategoryRows[1][1]).toBe('4');
      expect(nonMultiSortCategoryRows[1][2]).toBe('Alice');

      expect(nonMultiSortCategoryRows[2][0]).toBe('A');
      expect(nonMultiSortCategoryRows[2][1]).toBe('5');
      expect(nonMultiSortCategoryRows[2][2]).toBe('John');

      expect(nonMultiSortCategoryRows[3][0]).toBe('A');
      expect(nonMultiSortCategoryRows[3][1]).toBe('1');
      expect(nonMultiSortCategoryRows[3][2]).toBe('Bob');

      expect(nonMultiSortCategoryRows[4][0]).toBe('A');
      expect(nonMultiSortCategoryRows[4][1]).toBe('2');
      expect(nonMultiSortCategoryRows[4][2]).toBe('Charlie');

      await user.click(valueColumnButton);

      const nonMultiSortValueRows = getCellTextContent();

      expect(nonMultiSortValueRows[0][0]).toBe('A');
      expect(nonMultiSortValueRows[0][1]).toBe('1');
      expect(nonMultiSortValueRows[0][2]).toBe('Bob');

      expect(nonMultiSortValueRows[1][0]).toBe('A');
      expect(nonMultiSortValueRows[1][1]).toBe('2');
      expect(nonMultiSortValueRows[1][2]).toBe('Charlie');

      expect(nonMultiSortValueRows[2][0]).toBe('B');
      expect(nonMultiSortValueRows[2][1]).toBe('3');
      expect(nonMultiSortValueRows[2][2]).toBe('Jane');

      expect(nonMultiSortValueRows[3][0]).toBe('B');
      expect(nonMultiSortValueRows[3][1]).toBe('4');
      expect(nonMultiSortValueRows[3][2]).toBe('Alice');

      expect(nonMultiSortValueRows[4][0]).toBe('A');
      expect(nonMultiSortValueRows[4][1]).toBe('5');
      expect(nonMultiSortValueRows[4][2]).toBe('John');
    });

    it('correctly sorts different data types', async () => {
      // Create a data frame with different data types
      const mixedDataFrame = toDataFrame({
        name: 'MixedData',
        fields: [
          {
            name: 'String',
            type: FieldType.string,
            values: ['C', 'A', 'B'],
            config: { custom: {} },
            display: (v: string) => ({ text: v, numeric: 0 }),
          },
          {
            name: 'Number',
            type: FieldType.number,
            values: [3, 1, 2],
            config: { custom: {} },
            display: (v: number) => ({ text: String(v), numeric: v }),
          },
        ],
      });

      const processedFrame = applyFieldOverrides({
        data: [mixedDataFrame],
        fieldConfig: { defaults: {}, overrides: [] },
        replaceVariables: (value) => value,
        timeZone: 'utc',
        theme: createTheme(),
      })[0];

      const { container } = render(
        <TableNG enableVirtualization={false} data={processedFrame} width={800} height={600} />
      );

      // Get column headers
      const columnHeaders = container.querySelectorAll('[role="columnheader"]');

      // Test string column sorting
      const stringColumnButton = columnHeaders[0].querySelector('button') || columnHeaders[0];
      await user.click(stringColumnButton);

      // Get cell values after sorting
      let cells = container.querySelectorAll('[role="gridcell"]');
      let stringColumnCells = Array.from(cells).filter((_, index) => index % 2 === 0);
      let stringValues = stringColumnCells.map((cell) => cell.textContent);

      // Verify string values are sorted alphabetically
      expect(stringValues).toEqual(['A', 'B', 'C']);

      // Test number column sorting
      const numberColumnButton = columnHeaders[1].querySelector('button') || columnHeaders[1];
      await user.click(numberColumnButton);

      // Get cell values after sorting
      cells = container.querySelectorAll('[role="gridcell"]');
      let numberColumnCells = Array.from(cells).filter((_, index) => index % 2 === 1);
      let numberValues = numberColumnCells.map((cell) => cell.textContent);

      // Verify number values are sorted numerically
      expect(numberValues).toEqual(['1', '2', '3']);
    });

    it('triggers the onSortByChange callback', async () => {
      const onSortByChange = jest.fn();

      const { container } = render(
        <TableNG
          enableVirtualization={false}
          data={createBasicDataFrame()}
          width={800}
          height={600}
          onSortByChange={onSortByChange}
        />
      );

      // Ensure there are column headers
      const columnHeader = container.querySelector('[role="columnheader"]');
      expect(columnHeader).toBeInTheDocument();

      // Find the sort button within the first header
      if (!columnHeader) {
        throw new Error('No column header found');
      }

      // Look for a button inside the header
      const sortButton = columnHeader.querySelector('button') || columnHeader;

      // Click the sort button
      await user.click(sortButton);

      // After clicking, the header should have an aria-sort attribute
      expect(onSortByChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Filtering', () => {
    it('filters rows based on text filter', () => {
      const baseFrame = createBasicDataFrame();
      // Create a filter function that only shows rows with A1
      const filteredFrame = {
        ...baseFrame,
        length: 1,
        fields: createBasicDataFrame().fields.map((field) => ({
          ...field,
          values: field.name === 'Column A' ? ['A1'] : field.name === 'Column B' ? [1] : field.values,
        })),
      };

      // First render with unfiltered data
      const { container, rerender } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
      );

      // Check initial row count
      const initialRows = container.querySelectorAll('[role="row"]');
      const initialRowCount = initialRows.length - 1; // Subtract header row
      expect(initialRowCount).toBe(3); // Our basic frame has 3 rows

      // Rerender with filtered data
      rerender(<TableNG enableVirtualization={false} data={filteredFrame} width={800} height={600} />);

      // Check filtered row count
      const filteredRows = container.querySelectorAll('[role="row"]');
      const filteredRowCount = filteredRows.length - 1; // Subtract header row

      // Should only show one row (with A1)
      expect(filteredRowCount).toBe(1);

      // Verify the visible row contains "A1"
      const visibleCells = container.querySelectorAll('[role="gridcell"]');
      const cellTexts = Array.from(visibleCells).map((cell) => cell.textContent);
      expect(cellTexts).toContain('A1');
      expect(cellTexts).not.toContain('A2');
      expect(cellTexts).not.toContain('A3');
    });

    it('filters rows based on numeric filter', () => {
      // Create a filtered frame with only rows where Column B > 1
      const baseFrame = createBasicDataFrame();
      const filteredFrame = {
        ...baseFrame,
        length: 2,
        fields: baseFrame.fields.map((field) => ({
          ...field,
          values:
            field.name === 'Column A' ? ['A2', 'A3'] : field.name === 'Column B' ? [2, 3] : field.values.slice(1, 3),
        })),
      };

      // First render with unfiltered data
      const { container, rerender } = render(
        <TableNG enableVirtualization={false} data={baseFrame} width={800} height={600} />
      );

      // Check initial row count
      const initialRows = container.querySelectorAll('[role="row"]');
      const initialRowCount = initialRows.length - 1; // Subtract header row
      expect(initialRowCount).toBe(3);

      // Rerender with filtered data
      rerender(<TableNG enableVirtualization={false} data={filteredFrame} width={800} height={600} />);

      // Check filtered row count
      const filteredRows = container.querySelectorAll('[role="row"]');
      const filteredRowCount = filteredRows.length - 1; // Subtract header row
      expect(filteredRowCount).toBe(2);

      // Verify the visible rows contain the expected values
      const visibleCells = container.querySelectorAll('[role="gridcell"]');
      const cellTexts = Array.from(visibleCells).map((cell) => cell.textContent);
      expect(cellTexts).toContain('A2');
      expect(cellTexts).toContain('A3');
      expect(cellTexts).not.toContain('A1');
      expect(cellTexts).not.toContain('1');
    });

    it('updates footer calculations when rows are filtered', () => {
      // Create a filtered frame with only the first row
      const baseFrame = createBasicDataFrame();
      const filteredFrame = {
        ...baseFrame,
        length: 1,
        fields: baseFrame.fields.map((field) => ({
          ...field,
          values: field.name === 'Column A' ? ['A1'] : field.name === 'Column B' ? [1] : field.values.slice(0, 1),
        })),
      };

      // Render with unfiltered data and footer options
      const { container, rerender } = render(
        <TableNG
          enableVirtualization={false}
          data={baseFrame}
          width={800}
          height={600}
          footerOptions={{
            show: true,
            reducer: ['sum'],
            countRows: false,
          }}
        />
      );

      // Check initial footer sum (1+2+3=6)
      const initialFooter = container.querySelector('.rdg-summary-row');
      expect(initialFooter).toBeInTheDocument();

      // Get the text content of the footer cells
      const initialFooterCells = initialFooter?.querySelectorAll('[role="gridcell"]');
      const initialFooterTexts = Array.from(initialFooterCells || []).map((cell) => cell.textContent);

      // The second cell should contain the sum (6)
      expect(initialFooterTexts[1]).toBe('6');

      // Rerender with filtered data
      rerender(
        <TableNG
          enableVirtualization={false}
          data={filteredFrame}
          width={800}
          height={600}
          footerOptions={{
            show: true,
            reducer: ['sum'],
            countRows: false,
          }}
        />
      );

      // Check filtered footer sum (should be 1)
      const filteredFooter = container.querySelector('.rdg-summary-row');
      expect(filteredFooter).toBeInTheDocument();

      // Get the text content of the footer cells
      const filteredFooterCells = filteredFooter?.querySelectorAll('[role="gridcell"]');
      const filteredFooterTexts = Array.from(filteredFooterCells || []).map((cell) => cell.textContent);

      // The second cell should contain the sum (1)
      expect(filteredFooterTexts[1]).toBe('1');
    });

    it('filters rows with case-insensitive text matching', () => {
      // Create a case-insensitive filtered frame (filtering for 'a1' should match 'A1')
      const baseFrame = createBasicDataFrame();
      const filteredFrame = {
        ...baseFrame,
        length: 1,
        fields: baseFrame.fields.map((field) => ({
          ...field,
          values: field.name === 'Column A' ? ['A1'] : field.name === 'Column B' ? [1] : field.values.slice(0, 1),
        })),
      };

      // First render with unfiltered data
      const { container, rerender } = render(
        <TableNG enableVirtualization={false} data={baseFrame} width={800} height={600} />
      );

      // Rerender with filtered data
      rerender(<TableNG enableVirtualization={false} data={filteredFrame} width={800} height={600} />);

      // Check filtered row count
      const filteredRows = container.querySelectorAll('[role="row"]');
      const filteredRowCount = filteredRows.length - 1; // Subtract header row
      expect(filteredRowCount).toBe(1);

      // Verify the visible row contains "A1"
      const visibleCells = container.querySelectorAll('[role="gridcell"]');
      const cellTexts = Array.from(visibleCells).map((cell) => cell.textContent);
      expect(cellTexts).toContain('A1');
      expect(cellTexts).not.toContain('A2');
    });
  });

  describe('Text wrapping', () => {
    it('defaults to not wrapping text', () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
      );

      const cells = container.querySelectorAll('[role="gridcell"]');
      const cellStyles = window.getComputedStyle(cells[0]);
      expect(cellStyles.getPropertyValue('white-space')).not.toBe('pre-line');
    });

    it('applies text wrapping styles when wrapText is true', () => {
      // Create a frame with text wrapping enabled
      const frame = createBasicDataFrame();
      frame.fields.forEach((field) => {
        if (field.config?.custom) {
          field.config.custom.cellOptions = {
            ...field.config.custom.cellOptions,
            wrapText: true,
          };
        }
      });

      const { container } = render(
        <TableNG
          enableVirtualization={false}
          data={frame}
          width={800}
          height={600}
          fieldConfig={{
            defaults: {
              custom: {
                cellOptions: {
                  wrapText: true,
                },
              },
            },
            overrides: [],
          }}
        />
      );

      // Check for cells with wrap styling
      const cells = container.querySelectorAll('[role="gridcell"]');
      const cellStyles = window.getComputedStyle(cells[0]);

      // In the getStyles function, when textWrap is true, whiteSpace is set to 'pre-line'
      expect(cellStyles.getPropertyValue('white-space')).toBe('pre-line');
    });
  });

  describe('Cell inspection', () => {
    it('shows inspect icon when hovering over a cell with inspection enabled', async () => {
      const inspectDataFrame = {
        ...createBasicDataFrame(),
        fields: createBasicDataFrame().fields.map((field) => ({
          ...field,
          config: {
            ...field.config,
            custom: {
              ...field.config.custom,
              inspect: true,
            },
          },
        })),
      };

      // Render the component
      const { container } = render(
        <TableNG
          enableVirtualization={false}
          // fieldConfig={inspectDataFrame.fields[0].config}
          data={inspectDataFrame}
          width={800}
          height={600}
        />
      );

      // Find a cell to hover over
      const cell = container.querySelector('[role="gridcell"]');
      expect(cell).toBeInTheDocument();

      if (cell) {
        // Find the first div inside the cell (the actual content container)
        const cellContent = cell.querySelector('div');
        expect(cellContent).toBeInTheDocument();

        if (cellContent) {
          // Trigger mouse enter on the cell content
          await user.hover(cellContent);

          // Look for the inspect icon
          const inspectIcon = container.querySelector('[aria-label="Inspect value"]');
          expect(inspectIcon).toBeInTheDocument();
        }
      }
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes for accessibility', () => {
      const { container } = render(
        <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
      );

      // Check that the table has a grid role
      const grid = container.querySelector('[role="grid"]');
      expect(grid).toBeInTheDocument();

      // Check for row and column headers with proper roles
      const rows = container.querySelectorAll('[role="row"]');
      expect(rows.length).toBeGreaterThan(0);

      const columnHeaders = container.querySelectorAll('[role="columnheader"]');
      expect(columnHeaders.length).toBeGreaterThan(0);

      // Check for grid cells
      const cells = container.querySelectorAll('[role="gridcell"]');
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  describe('Cell display modes', () => {
    it('renders color background cells correctly', () => {
      // Create a frame with color background cells
      const frame = createBasicDataFrame();
      frame.fields[0].config.custom = {
        ...frame.fields[0].config.custom,
        cellOptions: {
          type: TableCellDisplayMode.ColorBackground,
          wrapText: false,
          mode: TableCellDisplayMode.BasicGauge,
          applyToRow: false,
        },
      };

      // Add color to the display values
      const originalDisplay = frame.fields[0].display;
      const expectedColor = '#ff0000'; // Red color
      frame.fields[0].display = (value: unknown) => {
        const displayValue = originalDisplay ? originalDisplay(value) : { text: String(value), numeric: 0 };
        return {
          ...displayValue,
          color: expectedColor,
        };
      };

      const { container } = render(<TableNG enableVirtualization={false} data={frame} width={800} height={600} />);

      // Find cells in the first column
      const cells = container.querySelectorAll('[role="gridcell"]');
      expect(cells.length).toBeGreaterThan(0);

      // Check the first div inside the cell for style attributes
      const cell = cells[0];
      const styleAttr = window.getComputedStyle(cell);

      // Expected color is red
      expect(styleAttr.background).toBe('rgb(255, 0, 0)');
    });

    it('renders color text cells correctly', () => {
      // Create a frame with color text cells
      const frame = createBasicDataFrame();
      const expectedColor = '#ff0000'; // Red color

      frame.fields[0].config.custom = {
        ...frame.fields[0].config.custom,
        cellOptions: {
          type: TableCellDisplayMode.ColorText,
          wrapText: false,
        },
      };

      // Add color to the display values
      const originalDisplay = frame.fields[0].display;
      frame.fields[0].display = (value: unknown) => {
        const displayValue = originalDisplay ? originalDisplay(value) : { text: String(value), numeric: 0 };
        return {
          ...displayValue,
          color: expectedColor,
        };
      };

      const { container } = render(<TableNG enableVirtualization={false} data={frame} width={800} height={600} />);

      // Find cells in the first column
      const cells = container.querySelectorAll('[role="gridcell"]');
      expect(cells.length).toBeGreaterThan(0);

      // Check the first div inside the cell for style attributes
      const cell = cells[0];
      const computedStyle = window.getComputedStyle(cell);

      // Expected color is red
      expect(computedStyle.color).toBe('rgb(255, 0, 0)');

      // doesn't accidentally applyToRow
      const otherCell = cells[1];
      expect(window.getComputedStyle(otherCell).color).not.toBe('rgb(255, 0, 0)');
    });

    it("renders the background color correclty when using 'ColorBackground' display mode and applyToRow is true", () => {
      // Create a frame with color background cells and applyToRow set to true
      const frame = createBasicDataFrame();
      frame.fields[0].config.custom = {
        ...frame.fields[0].config.custom,
        cellOptions: {
          type: TableCellDisplayMode.ColorBackground,
          applyToRow: true,
          mode: TableCellBackgroundDisplayMode.Basic,
        },
      };

      // Add color to the display values
      const originalDisplay = frame.fields[0].display;
      const expectedColor = '#ff0000'; // Red color
      frame.fields[0].display = (value: unknown) => {
        const displayValue = originalDisplay ? originalDisplay(value) : { text: String(value), numeric: 0 };
        return {
          ...displayValue,
          color: expectedColor,
        };
      };

      const { container } = render(<TableNG enableVirtualization={false} data={frame} width={800} height={600} />);

      // Find rows in the table
      const rows = container.querySelectorAll('[role="row"]');
      const cells = rows[1].querySelectorAll('[role="gridcell"]'); // Skip header row
      for (const cell of cells) {
        const cellStyle = window.getComputedStyle(cell);
        // Ensure each cell has the same background color
        expect(cellStyle.backgroundColor).toBe('rgb(255, 0, 0)');
      }
    });
  });

  describe('Row hover functionality for shared crosshair', () => {
    const mockEventBus: EventBus = {
      publish: jest.fn(),
      getStream: jest.fn(),
      subscribe: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    };

    const mockPanelContext: PanelContext = {
      eventsScope: 'test',
      eventBus: mockEventBus,
      onSeriesColorChange: jest.fn(),
      onToggleSeriesVisibility: jest.fn(),
      canAddAnnotations: jest.fn(),
      canEditAnnotations: jest.fn(),
      canDeleteAnnotations: jest.fn(),
      onAnnotationCreate: jest.fn(),
      onAnnotationUpdate: jest.fn(),
      onAnnotationDelete: jest.fn(),
      onSelectRange: jest.fn(),
      onAddAdHocFilter: jest.fn(),
      canEditThresholds: false,
      showThresholds: false,
      onThresholdsChange: jest.fn(),
      instanceState: {},
      onInstanceStateChange: jest.fn(),
      onToggleLegendSort: jest.fn(),
      onUpdateData: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should publish DataHoverEvent when hovering over a row with time field', async () => {
      const data = createTimeDataFrame();
      render(
        <PanelContextProvider value={mockPanelContext}>
          <TableNG enableVirtualization={false} data={data} width={800} height={600} enableSharedCrosshair />
        </PanelContextProvider>
      );

      await userEvent.hover(screen.getAllByRole('row')[1]);

      expect(mockEventBus.publish).toHaveBeenCalledWith({
        payload: {
          point: {
            time: data.fields[0].values[0],
          },
        },
        type: 'data-hover',
      });
    });

    it('should not publish DataHoverEvent when enableSharedCrosshair is false', async () => {
      render(
        <PanelContextProvider value={mockPanelContext}>
          <TableNG
            enableVirtualization={false}
            data={createTimeDataFrame()}
            width={800}
            height={600}
            enableSharedCrosshair={false}
          />
        </PanelContextProvider>
      );

      await userEvent.hover(screen.getAllByRole('row')[1]);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should not publish DataHoverEvent when time field is not present', async () => {
      render(
        <PanelContextProvider value={mockPanelContext}>
          <TableNG
            enableVirtualization={false}
            data={createBasicDataFrame()}
            width={800}
            height={600}
            enableSharedCrosshair
          />
        </PanelContextProvider>
      );

      await userEvent.hover(screen.getAllByRole('row')[1]);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should publish DataHoverClearEvent when leaving a row', async () => {
      render(
        <PanelContextProvider value={mockPanelContext}>
          <TableNG
            enableVirtualization={false}
            data={createTimeDataFrame()}
            width={800}
            height={600}
            enableSharedCrosshair
          />
        </PanelContextProvider>
      );

      await userEvent.hover(screen.getAllByRole('row')[1]);
      await userEvent.unhover(screen.getAllByRole('row')[1]);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data-hover-clear',
        })
      );
    });

    it('should not publish DataHoverClearEvent when enableSharedCrosshair is false', async () => {
      render(
        <PanelContextProvider value={mockPanelContext}>
          <TableNG
            enableVirtualization={false}
            data={createTimeDataFrame()}
            width={800}
            height={600}
            enableSharedCrosshair={false}
          />
        </PanelContextProvider>
      );

      await userEvent.hover(screen.getAllByRole('row')[1]);
      await userEvent.unhover(screen.getAllByRole('row')[1]);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Displays data Links', () => {
    function toLinkModel(link: DataLink): LinkModel {
      return {
        href: link.url,
        title: link.title,
        target: link.targetBlank ? '_blank' : '_self',
        origin: link.origin || 'panel',
      };
    }

    it('shows multiple datalinks in the tooltip', async () => {
      const dataFrame = createBasicDataFrame();
      const links: DataLink[] = [
        { url: 'http://asdasd.com', title: 'Test Title' },
        { url: 'http://asdasd2.com', title: 'Test Title2' },
      ];

      dataFrame.fields[0].config.links = links;
      dataFrame.fields[0].getLinks = () => links.map(toLinkModel);

      render(<TableNG enableVirtualization={false} data={dataFrame} width={800} height={600} />);

      const cell = screen.getByText('A1');
      await userEvent.click(cell);

      const tooltip = screen.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper);
      expect(tooltip).toBeInTheDocument();

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Title2')).toBeInTheDocument();
    });

    it('does not show tooltip for a single link', async () => {
      const dataFrame = createBasicDataFrame();

      const links: DataLink[] = [{ url: 'http://asdasd.com', title: 'Test Title' }];

      dataFrame.fields[0].config.links = links;
      dataFrame.fields[0].getLinks = () => links.map(toLinkModel);

      render(<TableNG enableVirtualization={false} data={dataFrame} width={800} height={600} />);

      const cell = screen.getByText('A1');

      // we need to click the parent since the cell itself is a link.
      await userEvent.click(cell.parentElement!);

      expect(screen.queryByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper)).not.toBeInTheDocument();
    });
  });
});
