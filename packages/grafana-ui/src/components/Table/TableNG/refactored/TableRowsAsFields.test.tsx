import { render, screen } from '@testing-library/react';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  FieldType,
  type FieldConfigSource,
  toDataFrame,
} from '@grafana/data';

import { type TableNGProps } from '../types';

import { RefactoredTableNG } from './RefactoredTableNG';

const withOverrides = (frame: ReturnType<typeof toDataFrame>, fieldConfig?: FieldConfigSource): DataFrame =>
  applyFieldOverrides({
    data: [frame],
    fieldConfig: fieldConfig ?? { defaults: {}, overrides: [] },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];

const createFrame = (fieldConfig?: FieldConfigSource): DataFrame =>
  withOverrides(
    toDataFrame({
      name: 'TestData',
      length: 3,
      fields: [
        { name: 'Column A', type: FieldType.string, values: ['A1', 'A2', 'A3'], config: { custom: {} } },
        { name: 'Column B', type: FieldType.number, values: [1, 2, 3], config: { custom: {} } },
      ],
    }),
    fieldConfig
  );

const renderTable = (data: DataFrame, extra?: Partial<TableNGProps>) =>
  render(
    <RefactoredTableNG rowsAsFields enableVirtualization={false} data={data} width={800} height={600} {...extra} />
  );

describe('TableRowsAsFields', () => {
  let origResizeObserver = global.ResizeObserver;
  let origScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    origResizeObserver = global.ResizeObserver;
    origScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    global.ResizeObserver = origResizeObserver;
    window.HTMLElement.prototype.scrollIntoView = origScrollIntoView;
  });

  it('renders one row per field with the field name in the frozen first column', () => {
    const { container } = renderTable(createFrame());

    expect(container.querySelector('[role="grid"]')).toBeInTheDocument();

    // One row per field (2 fields), each with a name cell + 3 value cells = 8 cells.
    const cells = container.querySelectorAll('[role="gridcell"]');
    expect(cells.length).toBe(8);

    // Field names appear as the row labels in column one.
    expect(screen.getByText('Column A')).toBeInTheDocument();
    expect(screen.getByText('Column B')).toBeInTheDocument();
  });

  it('lays each field out across the value columns (transposed)', () => {
    renderTable(createFrame());

    // Column A's values run along its row.
    ['A1', 'A2', 'A3'].forEach((v) => expect(screen.getByText(v)).toBeInTheDocument());
    // Column B's values run along its row.
    ['1', '2', '3'].forEach((v) => expect(screen.getByText(v)).toBeInTheDocument());
  });

  it('renders no header row (header collapsed to 0px)', () => {
    const { container } = renderTable(createFrame());

    const grid = container.querySelector('[role="grid"]');
    expect(grid).toBeInTheDocument();
    // react-data-grid always keeps a header row element, but in this mode it is collapsed to 0px and
    // hidden — the same treatment the `noHeader` option gives, so no header is shown to the user.
    expect(window.getComputedStyle(grid!).getPropertyValue('--rdg-header-row-height')).toBe('0px');
  });

  it('never renders a footer, even when a field configures footer reducers', () => {
    const frame = createFrame();
    const withFooter = {
      ...frame,
      fields: frame.fields.map((field) => ({
        ...field,
        config: { ...field.config, custom: { ...field.config.custom, footer: { reducers: ['sum'] } } },
      })),
    };

    const { container } = renderTable(withFooter);

    expect(container.querySelector('.rdg-summary-row')).not.toBeInTheDocument();
  });

  it('does not render sort or filter affordances', () => {
    const { container } = renderTable(createFrame());

    // Columns are not sortable and the header is hidden, so there is no sort state and no
    // sort/filter buttons in the (collapsed) header row.
    expect(container.querySelector('[aria-sort]')).not.toBeInTheDocument();
    container.querySelectorAll('[role="columnheader"]').forEach((header) => {
      expect(header.querySelector('button')).not.toBeInTheDocument();
    });
  });

  it('applies field overrides to the row (renamed field shows as the row label)', () => {
    // The field-override pipeline delivers a renamed field as `field.state.displayName`; getDisplayName
    // reads it, so an override surfaces on the field's ROW label rather than on a column header.
    const data = createFrame();
    data.fields[1].state = { ...data.fields[1].state, displayName: 'Renamed B' };

    renderTable(data);

    expect(screen.getByText('Renamed B')).toBeInTheDocument();
    expect(screen.queryByText('Column B')).not.toBeInTheDocument();
  });
});
