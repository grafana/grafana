import { render, screen } from '@testing-library/react';

import { applyFieldOverrides, createTheme, type DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { type CustomCellRendererProps, TableCellDisplayMode } from '../../types';

import { TableCore } from './TableCore';

const withFieldOverrides = (frame: ReturnType<typeof toDataFrame>): DataFrame =>
  applyFieldOverrides({
    data: [frame],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];

describe('TableCore (lean table)', () => {
  it('renders headers and cell values', () => {
    const data = withFieldOverrides(
      toDataFrame({
        name: 'TestData',
        fields: [
          { name: 'Letter', type: FieldType.string, values: ['a', 'b'] },
          { name: 'Number', type: FieldType.number, values: [1, 2] },
        ],
      })
    );

    render(<TableCore enableVirtualization={false} data={data} width={400} height={200} />);

    expect(screen.getByText('Letter')).toBeInTheDocument();
    expect(screen.getByText('Number')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders fields configured with a rich cell type (gauge) as plain text', () => {
    // The lean resolver ignores the panel-oriented cell-type registry, so a gauge-configured
    // field falls back to the Auto (text) renderer rather than rendering a BarGauge.
    const data = withFieldOverrides(
      toDataFrame({
        name: 'TestData',
        fields: [
          {
            name: 'Score',
            type: FieldType.number,
            values: [42],
            config: { custom: { cellOptions: { type: TableCellDisplayMode.Gauge } } },
          },
        ],
      })
    );

    render(<TableCore enableVirtualization={false} data={data} width={400} height={200} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders the custom-cell seam', () => {
    const CustomCell = ({ value }: CustomCellRendererProps) => (
      <span data-testid="custom-cell">custom:{`${value}`}</span>
    );
    const data = withFieldOverrides(
      toDataFrame({
        name: 'TestData',
        fields: [
          {
            name: 'Letter',
            type: FieldType.string,
            values: ['a'],
            config: { custom: { cellOptions: { type: TableCellDisplayMode.Custom, cellComponent: CustomCell } } },
          },
        ],
      })
    );

    render(<TableCore enableVirtualization={false} data={data} width={400} height={200} />);

    expect(screen.getByTestId('custom-cell')).toHaveTextContent('custom:a');
  });
});
