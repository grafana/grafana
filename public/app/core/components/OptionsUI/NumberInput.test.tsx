import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { NumberInput } from './NumberInput';

const setup = (min?: number, max?: number): HTMLInputElement => {
  render(<NumberInput value={0} onChange={() => {}} max={max} min={min} />);
  return screen.getByTestId('input-wrapper').firstChild?.firstChild as HTMLInputElement;
};

describe('NumberInput', () => {
  it('updated input correctly', () => {
    const input = setup();

    const tests = [
      {
        value: '-10',
        expected: -10,
      },
      {
        value: '',
        expected: null,
      },
      {
        value: '100',
        expected: 100,
      },
      {
        value: '1asd',
        expected: null,
      },
      {
        value: -100,
        expected: -100,
      },
      {
        value: 20,
        expected: 20,
      },
      {
        value: 0,
        expected: 0,
      },
      {
        value: '0',
        expected: 0,
      },
    ];

    tests.forEach((test) => {
      fireEvent.change(input, { target: { value: test.value } });
      expect(input).toHaveValue(test.expected);
    });
  });

  it('corrects input as per min and max', async () => {
    let input = setup(-10, 10);

    const tests = [
      {
        value: '-10',
        expected: -10,
      },
      {
        value: '-100',
        expected: -10,
      },
      {
        value: '10',
        expected: 10,
      },
      {
        value: '100',
        expected: 10,
      },
      {
        value: '5',
        expected: 5,
      },
    ];

    tests.forEach((test) => {
      input = screen.getByTestId('input-wrapper').firstChild?.firstChild as HTMLInputElement;
      fireEvent.blur(input, { target: { value: test.value } });
      expect(screen.getByTestId('input-wrapper').firstChild?.firstChild).toHaveValue(test.expected);
    });
  });
});
