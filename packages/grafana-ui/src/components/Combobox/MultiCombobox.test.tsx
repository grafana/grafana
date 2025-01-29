import { act, render, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import React from 'react';

import { MultiCombobox, MultiComboboxProps } from './MultiCombobox';
import { ComboboxOption } from './types';

describe('MultiCombobox', () => {
  beforeAll(() => {
    const mockGetBoundingClientRect = jest.fn(() => ({
      width: 120,
      height: 120,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    }));

    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect,
    });
  });

  let user: UserEvent;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it('should render with options', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    render(<MultiCombobox options={options} value={[]} onChange={jest.fn()} />);
    const input = screen.getByRole('combobox');
    user.click(input);
    expect(await screen.findByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('should render with value', () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    render(<MultiCombobox options={options} value={['a']} onChange={jest.fn()} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should render with placeholder', () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    render(<MultiCombobox options={options} value={[]} onChange={jest.fn()} placeholder="Select" />);
    expect(screen.getByPlaceholderText('Select')).toBeInTheDocument();
  });

  it.each([
    ['a', 'b', 'c'],
    [1, 2, 3],
  ])('should call onChange with the correct values', async (first, second, third) => {
    const options = [
      { label: 'A', value: first },
      { label: 'B', value: second },
      { label: 'C', value: third },
    ];
    const onChange = jest.fn();

    const ControlledMultiCombobox = (props: MultiComboboxProps<string | number>) => {
      const [value, setValue] = React.useState<string[] | number[]>([]);
      return (
        <MultiCombobox
          {...props}
          value={value}
          onChange={(val) => {
            //@ts-expect-error Don't do this for real life use cases
            setValue(val ?? []);
            onChange(val);
          }}
        />
      );
    };

    render(<ControlledMultiCombobox options={options} value={[]} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.click(await screen.findByRole('option', { name: 'A' }));

    // Second option
    await user.click(screen.getByRole('option', { name: 'C' }));

    // Deselect
    await user.click(screen.getByRole('option', { name: 'A' }));

    expect(onChange).toHaveBeenNthCalledWith(1, [{ label: 'A', value: first }]);
    expect(onChange).toHaveBeenNthCalledWith(2, [
      { label: 'A', value: first },
      { label: 'C', value: third },
    ]);
    expect(onChange).toHaveBeenNthCalledWith(3, [{ label: 'C', value: third }]);
  });

  it('should be able to render a value that is not in the options', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    render(<MultiCombobox width={200} options={options} value={['a', 'd', 'c']} onChange={jest.fn()} />);
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByText('d')).toBeInTheDocument();
  });

  describe('all option', () => {
    it('should render all option', async () => {
      const options = [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ];
      render(<MultiCombobox width={200} options={options} value={['a']} onChange={jest.fn()} enableAllOption />);
      const input = screen.getByRole('combobox');
      await user.click(input);
      expect(await screen.findByRole('option', { name: 'All' })).toBeInTheDocument();
    });

    it('should select all option', async () => {
      const options = [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ];
      const onChange = jest.fn();
      render(<MultiCombobox width={200} options={options} value={['a']} onChange={onChange} enableAllOption />);
      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.click(await screen.findByText('All'));

      expect(onChange).toHaveBeenCalledWith([
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ]);
    });

    it('should deselect all option', async () => {
      const options = [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ];
      const onChange = jest.fn();
      render(
        <MultiCombobox width={200} options={options} value={['a', 'b', 'c']} onChange={onChange} enableAllOption />
      );
      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.click(await screen.findByRole('option', { name: 'All' }));
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });

  describe('async', () => {
    const onChangeHandler = jest.fn();
    let user: ReturnType<typeof userEvent.setup>;

    beforeAll(() => {
      user = userEvent.setup({ delay: null });
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    afterEach(() => {
      onChangeHandler.mockReset();
    });

    // Assume that most apis only return with the value
    const simpleAsyncOptions = [{ value: 'Option 1' }, { value: 'Option 2' }, { value: 'Option 3' }];

    it('should allow async options', async () => {
      const asyncOptions = jest.fn(() => Promise.resolve(simpleAsyncOptions));
      render(<MultiCombobox options={asyncOptions} value={[]} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Debounce
      await act(async () => jest.advanceTimersByTime(200));

      expect(asyncOptions).toHaveBeenCalled();
    });

    it('should allow async options and select value', async () => {
      const asyncOptions = jest.fn(() => Promise.resolve(simpleAsyncOptions));
      render(<MultiCombobox options={asyncOptions} value={[]} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      const item = await screen.findByRole('option', { name: 'Option 3' });
      await user.click(item);

      expect(onChangeHandler).toHaveBeenCalledWith([simpleAsyncOptions[2]]);
    });

    it('should retain values not returned by the async function', async () => {
      const asyncOptions = jest.fn(() => Promise.resolve(simpleAsyncOptions));
      render(<MultiCombobox options={asyncOptions} value={[{ value: 'Option 69' }]} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      const item = await screen.findByRole('option', { name: 'Option 3' });
      await user.click(item);

      expect(onChangeHandler).toHaveBeenCalledWith([{ value: 'Option 69' }, { value: 'Option 3' }]);
    });

    it('should ignore late responses', async () => {
      const asyncOptions = jest.fn(async (searchTerm: string) => {
        if (searchTerm === 'a') {
          return promiseResolvesWith([{ value: 'first' }], 1500);
        } else if (searchTerm === 'ab') {
          return promiseResolvesWith([{ value: 'second' }], 500);
        } else if (searchTerm === 'abc') {
          return promiseResolvesWith([{ value: 'third' }], 800);
        }

        return Promise.resolve([]);
      });

      render(<MultiCombobox options={asyncOptions} value={[]} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await user.keyboard('a');
      act(() => jest.advanceTimersByTime(200)); // Skip debounce

      await user.keyboard('b');
      act(() => jest.advanceTimersByTime(200)); // Skip debounce

      await user.keyboard('c');
      act(() => jest.advanceTimersByTime(500)); // Resolve the second request, should be ignored

      expect(screen.queryByRole('option', { name: 'first' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'second' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'third' })).not.toBeInTheDocument();

      jest.advanceTimersByTime(800); // Resolve the third request, should be shown
      expect(screen.queryByRole('option', { name: 'first' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'second' })).not.toBeInTheDocument();
      expect(await screen.findByRole('option', { name: 'third' })).toBeInTheDocument();

      jest.advanceTimersByTime(1500); // Resolve the first request, should be ignored
      expect(screen.queryByRole('option', { name: 'first' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'second' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'third' })).toBeInTheDocument();

      jest.clearAllTimers();
    });

    it('should debounce requests', async () => {
      const asyncOptions = jest.fn(async () => {
        return promiseResolvesWith([{ value: 'Option 3' }], 1);
      });

      render(<MultiCombobox options={asyncOptions} value={[]} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await user.keyboard('a');
      act(() => jest.advanceTimersByTime(10));

      await user.keyboard('b');
      act(() => jest.advanceTimersByTime(10));

      await user.keyboard('c');
      act(() => jest.advanceTimersByTime(200));

      const item = await screen.findByRole('option', { name: 'Option 3' });
      expect(item).toBeInTheDocument();

      expect(asyncOptions).toHaveBeenCalledTimes(1);
      expect(asyncOptions).toHaveBeenCalledWith('abc');
    });
  });
});

function promiseResolvesWith(value: ComboboxOption[], timeout = 0) {
  return new Promise<ComboboxOption[]>((resolve) => setTimeout(() => resolve(value), timeout));
}
