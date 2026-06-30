import { render, screen } from '@testing-library/react';

import { createDataFrame, FieldType } from '@grafana/data';

import { MAX_FIELDS_A11Y_TABLE, MAX_ROWS_A11Y_TABLE, UPlotA11y } from './UPlotA11y';

describe('UPlotA11y', () => {
  it('renders a no-data message when there are no frames', () => {
    render(<UPlotA11y frames={[]} id="a11y" />);
    expect(screen.getByText('Chart has no data to display.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders a no-data message when frames have no rows', () => {
    const frame = createDataFrame({ fields: [{ name: 'time', type: FieldType.time, values: [] }] });
    render(<UPlotA11y frames={[frame]} id="a11y" />);
    expect(screen.getByText('Chart has no data to display.')).toBeInTheDocument();
  });

  it('renders a table with headers and formatted values from the source frames', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        // a display processor is used to format the value, mirroring how the panel renders it
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 20],
          display: (v) => ({ text: `${v}%`, numeric: Number(v) }),
        },
      ],
    });

    render(<UPlotA11y frames={[frame]} id="a11y" />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'time' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'value' })).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('renders one table per frame (e.g. faceted heatmap data)', () => {
    const frames = [
      createDataFrame({ name: 'A', fields: [{ name: 'x', type: FieldType.number, values: [1] }] }),
      createDataFrame({ name: 'B', fields: [{ name: 'y', type: FieldType.number, values: [2] }] }),
    ];

    render(<UPlotA11y frames={frames} id="a11y" />);

    expect(screen.getAllByRole('table')).toHaveLength(2);
  });

  it('bails out when there are too many fields', () => {
    const fields = Array.from({ length: MAX_FIELDS_A11Y_TABLE + 1 }, (_, i) => ({
      name: `f${i}`,
      type: FieldType.number,
      values: [1],
    }));
    const frame = createDataFrame({ fields });

    render(<UPlotA11y frames={[frame]} id="a11y" />);

    expect(screen.getByText('Chart has too much data to display in a table for accessibility.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('bails out when there are too many rows', () => {
    const frame = createDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: Array.from({ length: MAX_ROWS_A11Y_TABLE + 1 }, () => 1) }],
    });

    render(<UPlotA11y frames={[frame]} id="a11y" />);

    expect(screen.getByText('Chart has too much data to display in a table for accessibility.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
