import { render, screen } from 'test/test-utils';

import { FieldType, toDataFrame } from '@grafana/data';
import { type ColorDimensionConfig } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';

import { ColorDimensionEditor } from './ColorDimensionEditor';

const context = {
  data: [toDataFrame({ fields: [{ name: 'temp', type: FieldType.number, values: [1, 2, 3] }] })],
};

function makeProps(value: ColorDimensionConfig, onChange = jest.fn()) {
  return {
    props: {
      value,
      onChange,
      context,
      item: { settings: {} },
      id: 'color',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    onChange,
  };
}

beforeEach(() => mockComboboxRect());

describe('ColorDimensionEditor', () => {
  it('shows the color picker for a fixed color', () => {
    const { props } = makeProps({ fixed: 'red', field: undefined });
    render(<ColorDimensionEditor {...props} />);

    // ColorPicker renders a swatch trigger button
    expect(screen.getByLabelText(/color/i)).toBeInTheDocument();
  });

  it('switches to a field mapping when a field option is chosen', async () => {
    const { props, onChange } = makeProps({ fixed: 'red', field: undefined });
    const { user } = render(<ColorDimensionEditor {...props} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'temp' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ field: 'temp' }));
  });

  it('returns to a fixed color (keeping the previous color) when Fixed color is chosen', async () => {
    const { props, onChange } = makeProps({ fixed: 'red', field: 'temp' });
    const { user } = render(<ColorDimensionEditor {...props} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Fixed color' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ field: undefined, fixed: 'red' }));
  });
});
