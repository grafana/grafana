import { render, screen } from 'test/test-utils';

import { FieldType, toDataFrame } from '@grafana/data';
import { type ScaleDimensionConfig } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';

import { ScaleDimensionEditor } from './ScaleDimensionEditor';

const context = {
  data: [toDataFrame({ fields: [{ name: 'temp', type: FieldType.number, values: [1, 2, 3] }] })],
};

function makeProps(value: ScaleDimensionConfig, onChange = jest.fn()) {
  return {
    props: {
      value,
      onChange,
      context,
      item: { settings: { min: 0, max: 100 } },
      id: 'scale',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    onChange,
  };
}

beforeEach(() => mockComboboxRect());

describe('ScaleDimensionEditor', () => {
  it('shows the fixed value input when no field is selected', () => {
    const { props } = makeProps({ min: 0, max: 10, fixed: 5 });
    render(<ScaleDimensionEditor {...props} />);

    expect(screen.getByLabelText('Value')).toHaveValue(5);
    expect(screen.queryByLabelText('Min')).not.toBeInTheDocument();
  });

  it('emits a validated config when the fixed value changes', async () => {
    const { props, onChange } = makeProps({ min: 0, max: 10, fixed: 5 });
    const { user } = render(<ScaleDimensionEditor {...props} />);

    const input = screen.getByLabelText('Value');
    await user.clear(input);
    await user.type(input, '7');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fixed: 7, min: 0, max: 10 }));
  });

  it('shows min and max inputs when a field is selected', () => {
    const { props } = makeProps({ min: 2, max: 8, field: 'temp', fixed: 5 });
    render(<ScaleDimensionEditor {...props} />);

    expect(screen.getByLabelText('Min')).toHaveValue(2);
    expect(screen.getByLabelText('Max')).toHaveValue(8);
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
  });

  it('emits a validated config when the min changes', async () => {
    const { props, onChange } = makeProps({ min: 2, max: 8, field: 'temp', fixed: 5 });
    const { user } = render(<ScaleDimensionEditor {...props} />);

    const min = screen.getByLabelText('Min');
    await user.clear(min);
    await user.type(min, '3');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ min: 3, field: 'temp' }));
  });
});
