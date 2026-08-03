import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  BarGaugeDisplayMode,
  BarGaugeValueMode,
  TableCellDisplayMode,
  type TableBarGaugeCellOptions,
} from '@grafana/schema';

import { BarGaugeCellOptionsEditor } from './BarGaugeCellOptionsEditor';

function setup(cellOptions: Partial<TableBarGaugeCellOptions> = {}) {
  const onChange = jest.fn();
  render(
    <BarGaugeCellOptionsEditor cellOptions={{ type: TableCellDisplayMode.Gauge, ...cellOptions }} onChange={onChange} />
  );
  return { onChange };
}

describe('BarGaugeCellOptionsEditor', () => {
  it('defaults the display mode to Gradient and value display to Text when unset', () => {
    setup();
    expect(screen.getByRole('radio', { name: 'Gradient' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Text color' })).toBeChecked();
  });

  it('reflects the provided display and value modes', () => {
    setup({ mode: BarGaugeDisplayMode.Lcd, valueDisplayMode: BarGaugeValueMode.Hidden });
    expect(screen.getByRole('radio', { name: 'Retro LCD' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Hidden' })).toBeChecked();
  });

  it('emits the chosen gauge display mode', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'Basic' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: BarGaugeDisplayMode.Basic }));
  });

  it('emits the chosen value display mode', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'Value color' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ valueDisplayMode: BarGaugeValueMode.Color }));
  });
});
