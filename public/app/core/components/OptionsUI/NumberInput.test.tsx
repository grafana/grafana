import { act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InlineField } from '@grafana/ui';

import { NumberInput } from './NumberInput';

const setup = (min?: number, max?: number) => {
  const onChange = jest.fn();
  render(<NumberInput value={15} onChange={onChange} max={max} min={min} />);
  return {
    input: screen.getByRole('spinbutton'),
    onChange,
  };
};

describe('NumberInput', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('updated input correctly', () => {
    const data = setup();

    const tests = [
      {
        value: '-10',
        expected: -10,
        onChangeCalledWith: -10,
      },
      {
        value: '',
        expected: null,
        onChangeCalledWith: undefined,
      },
      {
        value: '100',
        expected: 100,
        onChangeCalledWith: 100,
      },
      {
        value: '1asd',
        expected: null,
        onChangeCalledWith: undefined,
      },
      {
        value: -100,
        expected: -100,
        onChangeCalledWith: -100,
      },
      {
        value: 20,
        expected: 20,
        onChangeCalledWith: 20,
      },
      {
        value: 0,
        expected: 0,
        onChangeCalledWith: 0,
      },
      {
        value: '0',
        expected: 0,
        onChangeCalledWith: 0,
      },
    ];

    tests.forEach((test, i) => {
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: test.value } });
      fireEvent.blur(input);
      expect(data.onChange).toHaveBeenCalledWith(test.onChangeCalledWith);
      expect(data.onChange).toBeCalledTimes(i + 1);
      expect(screen.getByRole('spinbutton')).toHaveValue(test.expected);
    });
  });

  it.each([
    ['a finite number', 25, 25],
    ['zero', 0, 0],
    ['undefined', undefined, null],
    ['NaN', Number.NaN, null],
  ])('synchronizes the input when the controlled value changes to %s', (_description, value, expected) => {
    const { rerender } = render(<NumberInput value={15} onChange={jest.fn()} />);

    rerender(<NumberInput value={value} onChange={jest.fn()} />);

    expect(screen.getByRole('spinbutton')).toHaveValue(expected);
  });

  it('corrects input as per min and max', async () => {
    const data = setup(-10, 10);
    let input = data.input;

    const tests = [
      {
        value: '-10',
        expected: -10,
        onChangeCalledWith: -10,
      },
      {
        value: '-100',
        expected: -10,
        onChangeCalledWith: -10,
      },
      {
        value: '10',
        expected: 10,
        onChangeCalledWith: 10,
      },
      {
        value: '100',
        expected: 10,
        onChangeCalledWith: 10,
      },
      {
        value: '5',
        expected: 5,
        onChangeCalledWith: 5,
      },
    ];

    tests.forEach((test, i) => {
      input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: test.value } });
      fireEvent.blur(input);
      expect(data.onChange).toHaveBeenCalledWith(test.onChangeCalledWith);
      expect(data.onChange).toBeCalledTimes(i + 1);
      expect(screen.getByRole('spinbutton')).toHaveValue(test.expected);
    });
  });

  it('shows the allowed range while the value is in range', () => {
    render(<NumberInput value={5} onChange={jest.fn()} min={1} max={200} />);

    expect(screen.getByText('Range: 1 to 200')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not clamp or show an error while typing an out of range value', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(<NumberInput value={5} onChange={onChange} min={1} max={200} />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '-9');
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(input).toHaveValue(-9);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Range: 1 to 200')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('clamps on blur and keeps the out of range message until the value is edited', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<NumberInput value={5} onChange={onChange} min={1} max={200} />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '-9');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(1);
    expect(screen.getByRole('spinbutton')).toHaveValue(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Out of range. Range: 1 to 200');
    expect(screen.getByText('Range: 1 to 200')).toBeInTheDocument();

    await user.type(input, '2');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('emits in-range values after the debounce without showing an error', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(<NumberInput value={5} onChange={onChange} min={1} max={200} />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '8');
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(onChange).toHaveBeenCalledWith(8);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it('emits zero after the debounce', () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(<NumberInput value={5} onChange={onChange} min={-1} max={200} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } });
    act(() => jest.advanceTimersByTime(500));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it.each([
    ['blur', (input: HTMLInputElement) => fireEvent.blur(input)],
    ['Enter', (input: HTMLInputElement) => fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })],
  ])('commits immediately on %s and cancels the pending debounced change', (_event, commit) => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(<NumberInput value={5} onChange={onChange} min={1} max={200} />);

    const input = screen.getByRole<HTMLInputElement>('spinbutton');
    fireEvent.change(input, { target: { value: '8' } });
    commit(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(8);

    act(() => jest.advanceTimersByTime(500));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('emits a pending in-range value after a parent rerender', () => {
    jest.useFakeTimers();
    const firstOnChange = jest.fn();
    const secondOnChange = jest.fn();
    const { rerender } = render(<NumberInput value={5} onChange={firstOnChange} min={1} max={200} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8' } });
    rerender(<NumberInput value={5} onChange={secondOnChange} min={1} max={200} />);
    act(() => jest.advanceTimersByTime(500));

    expect(firstOnChange).not.toHaveBeenCalled();
    expect(secondOnChange).toHaveBeenCalledWith(8);
  });

  it('does not emit a pending value outside updated bounds', () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    const { rerender } = render(<NumberInput value={5} onChange={onChange} min={1} max={200} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8' } });
    rerender(<NumberInput value={5} onChange={onChange} min={1} max={7} />);
    act(() => jest.advanceTimersByTime(500));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps a parent InlineField label when no id is passed', () => {
    render(
      <InlineField label="Window size">
        <NumberInput value={5} onChange={jest.fn()} min={1} max={10} />
      </InlineField>
    );

    expect(screen.getByRole('spinbutton', { name: 'Window size' })).toBeInTheDocument();
  });

  it('preserves parent InlineField validation semantics alongside the range hint', () => {
    render(
      <InlineField label="Window size" invalid error="Required">
        <NumberInput value={5} onChange={jest.fn()} min={1} max={10} />
      </InlineField>
    );

    const input = screen.getByRole('spinbutton', { name: 'Window size' });
    const error = screen.getByRole('alert');
    const range = screen.getByText('Range: 1 to 10');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual([error.id, range.id]);
  });

  it('keeps a trailing decimal after the debounce so typing can continue', async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    render(<NumberInput value={5} onChange={onChange} min={1} max={200} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1.' } });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '1.5' } });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(onChange).toHaveBeenCalledWith(1.5);

    jest.useRealTimers();
  });

  it('keeps the out of range message after a second blur without editing', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<NumberInput value={5} onChange={onChange} min={1} max={200} />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '-9');
    await user.tab();

    expect(screen.getByRole('alert')).toHaveTextContent('Out of range. Range: 1 to 200');

    fireEvent.blur(screen.getByRole('spinbutton'));

    expect(screen.getByRole('alert')).toHaveTextContent('Out of range. Range: 1 to 200');
  });

  it('describes the input with the range when valid and only the error when invalid', async () => {
    const user = userEvent.setup();
    render(<NumberInput value={5} onChange={jest.fn()} min={1} max={200} />);

    const input = screen.getByRole('spinbutton');
    const range = screen.getByText('Range: 1 to 200');
    expect(input).toHaveAttribute('aria-describedby', range.id);

    await user.clear(input);
    await user.type(input, '-9');
    await user.tab();

    const alert = screen.getByRole('alert');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
    expect(alert.id).not.toBe(range.id);
    expect(alert).toHaveTextContent('Out of range. Range: 1 to 200');
  });
});
