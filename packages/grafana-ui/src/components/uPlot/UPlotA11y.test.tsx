import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDataFrame, FieldType } from '@grafana/data';

import { FRAMES_PER_PAGE, ROWS_PER_PAGE, UPlotA11y } from './UPlotA11y';

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

  it('paginates rows, rendering only one page at a time', async () => {
    const rowCount = ROWS_PER_PAGE + 5;
    const frame = createDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: Array.from({ length: rowCount }, (_, i) => i) }],
    });

    render(<UPlotA11y frames={[frame]} id="a11y" />);

    // first page shows ROWS_PER_PAGE rows (no header row in tbody), not the whole frame
    expect(screen.getAllByRole('row')).toHaveLength(ROWS_PER_PAGE + 1); // +1 for the header row
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText(String(ROWS_PER_PAGE))).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    // second page reveals the remaining rows
    expect(screen.getByText(String(ROWS_PER_PAGE))).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('does not paginate rows at or below the page size', () => {
    const frame = createDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: Array.from({ length: ROWS_PER_PAGE }, (_, i) => i) }],
    });

    render(<UPlotA11y frames={[frame]} id="a11y" />);

    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
  });

  it('paginates frames, rendering only one page of tables at a time', async () => {
    const frames = Array.from({ length: FRAMES_PER_PAGE + 2 }, (_, i) =>
      createDataFrame({ name: `frame-${i}`, fields: [{ name: 'x', type: FieldType.number, values: [i] }] })
    );

    render(<UPlotA11y frames={frames} id="a11y" />);

    expect(screen.getAllByRole('table')).toHaveLength(FRAMES_PER_PAGE);
    expect(screen.getByText('frame-0')).toBeInTheDocument();
    expect(screen.queryByText(`frame-${FRAMES_PER_PAGE}`)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    // second page renders the remaining frames
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getByText(`frame-${FRAMES_PER_PAGE}`)).toBeInTheDocument();
  });
});
