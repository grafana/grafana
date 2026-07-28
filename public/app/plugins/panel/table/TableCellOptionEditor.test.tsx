import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { BarGaugeDisplayMode, TableCellDisplayMode, type TableCellOptions } from '@grafana/schema';
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

  it('renders the sub-editor matching the current cell type', () => {
    setup({ type: TableCellDisplayMode.Gauge });
    // the gauge sub-editor is the only cell type exposing a "Gauge display mode" control
    expect(screen.getByText('Gauge display mode')).toBeInTheDocument();
  });

  it('renders no sub-editor for cell types without extra options', () => {
    setup({ type: TableCellDisplayMode.Auto });
    expect(screen.queryByText('Gauge display mode')).not.toBeInTheDocument();
  });

  it('resets to just the new type (default settings) when the cell type changes', async () => {
    const { onChange } = setup({ type: TableCellDisplayMode.Auto });
    await selectCellType('Gauge');
    expect(onChange).toHaveBeenCalledWith({ type: TableCellDisplayMode.Gauge });
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
