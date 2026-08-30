import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { BarGaugeDisplayMode, BarGaugeValueMode, TableCellDisplayMode, type TableCellOptions } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';

import { TableCellOptionEditor } from './TableCellOptionEditor';

mockComboboxRect();

// Render the editor the way the panel framework does — controlled, feeding each
// onChange value back in as the next value — so type switches actually take effect.
function setup(initial: TableCellOptions = { type: TableCellDisplayMode.Auto }) {
  const onChange = jest.fn();
  function Wrapper() {
    const [value, setValue] = useState<TableCellOptions>(initial);
    return (
      <TableCellOptionEditor
        value={value}
        onChange={(v) => {
          onChange(v);
          setValue(v);
        }}
      />
    );
  }
  render(<Wrapper />);
  return { onChange };
}

// The cell-type list is virtualized to the first several options, so these
// helpers only drive types that are visible without scrolling (Gauge/Sparkline).
async function selectCellType(name: string) {
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name }));
}

describe('TableCellOptionEditor', () => {
  it('shows the label for the current cell type', () => {
    setup({ type: TableCellDisplayMode.ColorText });
    expect(screen.getByRole('combobox')).toHaveDisplayValue('Colored text');
  });

  // each cell type that has extra options renders its own sub-editor, identified
  // here by a control label unique to that sub-editor
  it.each<[TableCellOptions, string]>([
    [{ type: TableCellDisplayMode.Gauge }, 'Gauge display mode'],
    [{ type: TableCellDisplayMode.ColorBackground }, 'Background display mode'],
    [{ type: TableCellDisplayMode.Image }, 'Alt text'],
    [{ type: TableCellDisplayMode.Markdown }, 'Dynamic height'],
  ])('renders the sub-editor for %o', (cellOptions, controlLabel) => {
    setup(cellOptions);
    expect(screen.getByText(controlLabel)).toBeInTheDocument();
  });

  it('renders no sub-editor for cell types without extra options', () => {
    setup({ type: TableCellDisplayMode.Auto });
    expect(screen.queryByText('Gauge display mode')).not.toBeInTheDocument();
  });

  it('discards the previous type settings when the cell type changes', async () => {
    // start on a gauge with non-default settings configured
    const { onChange } = setup({
      type: TableCellDisplayMode.Gauge,
      mode: BarGaugeDisplayMode.Lcd,
      valueDisplayMode: BarGaugeValueMode.Hidden,
    });

    await selectCellType('Colored background');

    // the new value is exactly the new type — none of the gauge settings carry over
    expect(onChange).toHaveBeenCalledWith({ type: TableCellDisplayMode.ColorBackground });
  });

  it('merges sub-editor option changes into the current cell options', async () => {
    const { onChange } = setup({ type: TableCellDisplayMode.Gauge });
    // toggling the gauge sub-editor's display mode should surface a merged value
    await userEvent.click(screen.getByRole('radio', { name: 'Basic' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: TableCellDisplayMode.Gauge, mode: BarGaugeDisplayMode.Basic })
    );
  });

  it('restores previously edited settings when switching back to a cell type', async () => {
    const { onChange } = setup({ type: TableCellDisplayMode.Gauge });

    // edit the gauge sub-editor so its settings get cached
    await userEvent.click(screen.getByRole('radio', { name: 'Basic' }));
    onChange.mockClear();

    // leave gauge, then come back — the cached display mode should be re-applied
    await selectCellType('Auto');
    await selectCellType('Gauge');

    const restore = onChange.mock.calls.find(([v]) => v.type === TableCellDisplayMode.Gauge);
    expect(restore?.[0]).toEqual(expect.objectContaining({ mode: BarGaugeDisplayMode.Basic }));
  });
});
