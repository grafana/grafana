import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TableCellDisplayMode, type TablePillCellOptions, TablePillColorMode } from '@grafana/schema';

import { PillCellOptionsEditor } from './PillCellOptionsEditor';

function setup(cellOptions: Partial<TablePillCellOptions> = {}) {
  const onChange = jest.fn();
  render(
    <PillCellOptionsEditor cellOptions={{ type: TableCellDisplayMode.Pill, ...cellOptions }} onChange={onChange} />
  );
  return { onChange };
}

describe('PillCellOptionsEditor', () => {
  it('defaults the color mode to Auto when unset', () => {
    setup();
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
  });

  it('emits the background color mode when chosen', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'Background' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ colorMode: TablePillColorMode.Background }));
  });

  it('shows a configured background color mode as selected', () => {
    setup({ colorMode: TablePillColorMode.Background });
    expect(screen.getByRole('radio', { name: 'Background' })).toBeChecked();
  });
});
