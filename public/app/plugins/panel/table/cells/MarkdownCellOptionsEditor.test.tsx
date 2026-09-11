import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TableCellDisplayMode, type TableMarkdownCellOptions } from '@grafana/schema';

import { MarkdownCellOptionsEditor } from './MarkdownCellOptionsEditor';

function setup(cellOptions: Partial<TableMarkdownCellOptions> = {}) {
  const onChange = jest.fn();
  render(
    <MarkdownCellOptionsEditor
      cellOptions={{ type: TableCellDisplayMode.Markdown, ...cellOptions }}
      onChange={onChange}
    />
  );
  return { onChange };
}

describe('MarkdownCellOptionsEditor', () => {
  it('reflects the dynamicHeight value on the switch', () => {
    setup({ dynamicHeight: true });
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('enables dynamic height from an unset value', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dynamicHeight: true }));
  });

  it('disables dynamic height when already enabled', async () => {
    const { onChange } = setup({ dynamicHeight: true });
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dynamicHeight: false }));
  });
});
