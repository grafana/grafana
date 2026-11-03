import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { BinaryOperationID, FieldMatcherID } from '@grafana/data';
import { CalculateFieldMode, type CalculateFieldTransformerOptions } from '@grafana/data/internal';

import { BinaryOperationOptionsEditor } from './BinaryOperationOptionsEditor';

const options: CalculateFieldTransformerOptions = {
  mode: CalculateFieldMode.BinaryOperation,
  binary: {
    left: { matcher: { id: FieldMatcherID.byName, options: 'A' } },
    operator: BinaryOperationID.Divide,
    right: { fixed: '2' },
  },
};

const setup = () => {
  const onChange = jest.fn();
  render(<BinaryOperationOptionsEditor options={options} onChange={onChange} names={['A', 'B']} />);
  return { onChange };
};

describe('BinaryOperationOptionsEditor', () => {
  it.each([
    {
      desc: 'a variable',
      typed: '$__interval_ms',
      expected: { matcher: { id: FieldMatcherID.byName, options: '$__interval_ms' } },
    },
    { desc: 'a number', typed: '5', expected: { fixed: '5' } },
  ])('saves $desc typed as a custom right operand', async ({ typed, expected }) => {
    const { onChange } = setup();

    await userEvent.type(screen.getByRole('combobox', { name: 'Right operand' }), `${typed}{enter}`);

    expect(onChange).toHaveBeenCalledWith({
      ...options,
      binary: { ...options.binary, right: expected },
    });
  });

  it('saves a variable typed as a custom left operand', async () => {
    const { onChange } = setup();

    await userEvent.type(screen.getByRole('combobox', { name: 'Left operand' }), '$__interval_ms{enter}');

    expect(onChange).toHaveBeenCalledWith({
      ...options,
      binary: { ...options.binary, left: { matcher: { id: FieldMatcherID.byName, options: '$__interval_ms' } } },
    });
  });

  it('saves a field picked from the list as a by-name matcher', async () => {
    const { onChange } = setup();

    await selectOptionInTest(screen.getByRole('combobox', { name: 'Right operand' }), 'B');

    expect(onChange).toHaveBeenCalledWith({
      ...options,
      binary: { ...options.binary, right: { matcher: { id: FieldMatcherID.byName, options: 'B' } } },
    });
  });
});
