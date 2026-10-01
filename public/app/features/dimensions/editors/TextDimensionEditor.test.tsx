import { render, screen } from 'test/test-utils';

import { FieldType, toDataFrame } from '@grafana/data';
import { type TextDimensionConfig, TextDimensionMode } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';

import { type TextDimensionOptions } from '../types';

import { TextDimensionEditor } from './TextDimensionEditor';
import { makePropsFactory } from './test-utils';

const makeProps = makePropsFactory<TextDimensionConfig, TextDimensionOptions>(
  'text',
  {},
  {
    data: [toDataFrame({ fields: [{ name: 'label', type: FieldType.string, values: ['a', 'b'] }] })],
  }
);

beforeEach(() => mockComboboxRect());

describe('TextDimensionEditor', () => {
  it('shows the fixed value input in Fixed mode', () => {
    const { props } = makeProps({ mode: TextDimensionMode.Fixed, fixed: 'hello' });
    render(<TextDimensionEditor {...props} />);

    expect(screen.getByRole('radio', { name: 'Fixed' })).toBeChecked();
    expect(screen.getByLabelText('Value')).toHaveValue('hello');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('emits the trimmed fixed value on blur', async () => {
    const { props, onChange } = makeProps({ mode: TextDimensionMode.Fixed, fixed: 'hello' });
    const { user } = render(<TextDimensionEditor {...props} />);

    const input = screen.getByLabelText('Value');
    await user.clear(input);
    await user.type(input, '  world  ');
    await user.tab();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ mode: TextDimensionMode.Fixed, fixed: 'world' });
  });

  it('clears the fixed value via the clear button', async () => {
    const { props, onChange } = makeProps({ mode: TextDimensionMode.Fixed, fixed: 'hello' });
    const { user } = render(<TextDimensionEditor {...props} />);

    await user.click(screen.getByRole('button', { name: 'Clear value' }));

    expect(onChange).toHaveBeenCalledWith({ mode: TextDimensionMode.Fixed, fixed: '' });
  });

  it('does not render the clear button when there is no fixed value', () => {
    const { props } = makeProps({ mode: TextDimensionMode.Fixed, fixed: '' });
    render(<TextDimensionEditor {...props} />);

    expect(screen.queryByRole('button', { name: 'Clear value' })).not.toBeInTheDocument();
  });

  it('switches the source to Field via the radio group', async () => {
    const { props, onChange } = makeProps({ mode: TextDimensionMode.Fixed, fixed: 'hello' });
    const { user } = render(<TextDimensionEditor {...props} />);

    await user.click(screen.getByRole('radio', { name: 'Field' }));

    // Only the mode flips; the fixed value is preserved on the emitted config.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ mode: TextDimensionMode.Field, fixed: 'hello' });
  });

  it('renders the field picker instead of the value input in Field mode', () => {
    const { props } = makeProps({ mode: TextDimensionMode.Field, fixed: '', field: '' });
    render(<TextDimensionEditor {...props} />);

    expect(screen.getByRole('radio', { name: 'Field' })).toBeChecked();
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('emits the selected field when a field is chosen', async () => {
    const { props, onChange } = makeProps({ mode: TextDimensionMode.Field, fixed: '', field: '' });
    const { user } = render(<TextDimensionEditor {...props} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'label' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ mode: TextDimensionMode.Field, fixed: '', field: 'label' });
  });
});
