import { render, screen } from 'test/test-utils';

import { FieldType, toDataFrame } from '@grafana/data';
import { type ColorDimensionConfig } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';

import { type ColorDimensionOptions } from '../types';

import { ColorDimensionEditor } from './ColorDimensionEditor';
import { makePropsFactory } from './test-utils';

const makeProps = makePropsFactory<ColorDimensionConfig, ColorDimensionOptions>(
  'color',
  {},
  {
    data: [toDataFrame({ fields: [{ name: 'temp', type: FieldType.number, values: [1, 2, 3] }] })],
  }
);

beforeEach(() => mockComboboxRect());

describe('ColorDimensionEditor', () => {
  it('selects Fixed color mode and shows the color picker when the value is a fixed color', () => {
    const { props } = makeProps({ fixed: 'red', field: undefined });
    render(<ColorDimensionEditor {...props} />);

    // Fixed mode: the combobox reflects the "Fixed color" option (not a field), and the ColorPicker swatch is shown.
    expect(screen.getByRole('combobox')).toHaveValue('Fixed color');
    expect(screen.getByLabelText(/color/i)).toBeInTheDocument();
  });

  it('switches to a field mapping when a field option is chosen', async () => {
    const { props, onChange } = makeProps({ fixed: 'red', field: undefined });
    const { user } = render(<ColorDimensionEditor {...props} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'temp' }));

    // The previous fixed color is preserved on the config when moving to field mode.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ fixed: 'red', field: 'temp' });
  });

  it('returns to a fixed color (keeping the previous color) when Fixed color is chosen', async () => {
    const { props, onChange } = makeProps({ fixed: 'red', field: 'temp' });
    const { user } = render(<ColorDimensionEditor {...props} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Fixed color' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ fixed: 'red', field: undefined });
  });
});
