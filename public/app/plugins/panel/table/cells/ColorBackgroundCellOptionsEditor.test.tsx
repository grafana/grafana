import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
  type TableColoredBackgroundCellOptions,
} from '@grafana/schema';

import { ColorBackgroundCellOptionsEditor } from './ColorBackgroundCellOptionsEditor';

function setup(cellOptions: Partial<TableColoredBackgroundCellOptions> = {}) {
  const onChange = jest.fn();
  render(
    <ColorBackgroundCellOptionsEditor
      cellOptions={{ type: TableCellDisplayMode.ColorBackground, ...cellOptions }}
      onChange={onChange}
    />
  );
  return { onChange };
}

describe('ColorBackgroundCellOptionsEditor', () => {
  it('defaults the background display mode to Gradient when unset', () => {
    setup();
    expect(screen.getByRole('radio', { name: 'Gradient' })).toBeChecked();
  });

  it('emits the chosen background display mode', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'Basic' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: TableCellBackgroundDisplayMode.Basic }));
  });

  it('toggles "apply to entire row" on from an unset value', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ applyToRow: true }));
  });

  it('toggles "apply to entire row" back off', async () => {
    const { onChange } = setup({ applyToRow: true });
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ applyToRow: false }));
  });
});
