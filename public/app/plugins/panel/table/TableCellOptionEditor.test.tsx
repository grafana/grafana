import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { FlagKeys } from '@grafana/runtime/internal';
import { BarGaugeDisplayMode, BarGaugeValueMode, TableCellDisplayMode, type TableCellOptions } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

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
  render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <Wrapper />
    </OpenFeatureProvider>
  );
  return { onChange };
}

// The cell-type list is virtualized to the first several options, so these
// helpers only drive types that are visible without scrolling (Gauge/Sparkline).
async function selectCellType(name: string) {
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name }));
}

describe('TableCellOptionEditor', () => {
  afterEach(() => {
    cleanup();
    setTestFlags({});
  });

  it('defaults JSON highlighting on and persists disabling it without table.refresh', async () => {
    setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: true, [FlagKeys.TableRefresh]: false });
    const { onChange } = setup({ type: TableCellDisplayMode.JSONView });
    expect(screen.getByRole('switch', { name: 'Syntax highlighting' })).toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Syntax highlighting' }));
    expect(onChange).toHaveBeenLastCalledWith({ type: TableCellDisplayMode.JSONView, syntaxHighlighting: false });
    expect(screen.getByRole('switch', { name: 'Syntax highlighting' })).not.toBeChecked();
  });

  it('reads a saved highlighting opt-out', () => {
    setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: true });
    setup({ type: TableCellDisplayMode.JSONView, syntaxHighlighting: false });
    expect(screen.getByRole('combobox')).toHaveDisplayValue('JSON View');
    expect(screen.getByRole('switch', { name: 'Syntax highlighting' })).not.toBeChecked();
  });

  it.each([
    { enabled: false, type: TableCellDisplayMode.JSONView, label: 'JSON View' },
    { enabled: true, type: TableCellDisplayMode.Auto, label: 'Auto' },
  ] as const)('omits the switch for $label with new features=$enabled', ({ enabled, type, label }) => {
    setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: enabled, [FlagKeys.TableRefresh]: true });
    setup({ type });
    expect(screen.getByRole('combobox')).toHaveDisplayValue(label);
    expect(screen.queryByRole('switch', { name: 'Syntax highlighting' })).not.toBeInTheDocument();
  });

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
