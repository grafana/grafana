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

  it('should not render with placeholder when options selected', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    render(<MultiCombobox options={options} value={['a']} onChange={jest.fn()} placeholder="Select" />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('placeholder', '');
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

  it('should allow for options to be deselected', async () => {
    // This test ensures that our fix for async options doesn't break sync options
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    const onChange = jest.fn();

    const ControlledMultiCombobox = (props: MultiComboboxProps<string>) => {
      const [value, setValue] = React.useState<string[]>(['a']);
      return (
        <MultiCombobox
          {...props}
          value={value}
          onChange={(val) => {
            setValue(val.map((v) => v.value));
            onChange(val);
          }}
        />
      );
    };

    render(<ControlledMultiCombobox options={options} value={[]} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await user.click(input);

    // Click on option A to deselect it (it should be selected initially)
    await user.click(await screen.findByRole('option', { name: 'A' }));

    expect(onChange).toHaveBeenCalledWith([]);
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

  it('should be able to set custom value', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    const onChange = jest.fn();
    render(<MultiCombobox options={options} value={[]} onChange={onChange} createCustomValue />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'D');
    await user.keyboard('{arrowdown}{enter}');
    expect(onChange).toHaveBeenCalledWith([{ label: 'D', value: 'D', description: 'Use custom value' }]);
  });

  it('should be able to add custom value to the selected options', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    const onChange = jest.fn();
    render(<MultiCombobox options={options} value={['a', 'c']} onChange={onChange} createCustomValue />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'D');
    await user.keyboard('{arrowdown}{enter}');
    expect(onChange).toHaveBeenCalledWith([
      { label: 'A', value: 'a' },
      { label: 'C', value: 'c' },
      { label: 'D', value: 'D', description: 'Use custom value' },
    ]);
  });

  it('should remove value when clicking on the close icon of the pill', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    const onChange = jest.fn();
    render(<MultiCombobox width={200} options={options} value={['a', 'b', 'c']} onChange={onChange} />);
    const fistPillRemoveButton = await screen.findByRole('button', { name: 'Remove A' });
    await user.click(fistPillRemoveButton);
    expect(onChange).toHaveBeenCalledWith(options.filter((o) => o.value !== 'a'));
  });

  it('should remove all selected items when clicking on clear all button', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    const onChange = jest.fn();
    render(<MultiCombobox width={200} options={options} value={['a', 'b', 'c']} onChange={onChange} isClearable />);
    const clearAllButton = await screen.findByTitle('Clear all');
    await user.click(clearAllButton);
    expect(onChange).toHaveBeenCalledWith([]);
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

    it('should keep label names on selected items when searching', async () => {
      const options = [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ];
      render(<MultiCombobox width={200} options={options} value={['a']} onChange={jest.fn()} enableAllOption />);
      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'b');
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should not render All when only one option is available and enableAll is true', async () => {
      const options = [{ label: 'A', value: 'a' }];
      render(<MultiCombobox width={200} options={options} onChange={jest.fn()} enableAllOption />);
      const input = screen.getByRole('combobox');
      await user.click(input);
      expect(screen.queryByRole('option', { name: 'All' })).not.toBeInTheDocument();
    });

    it('should not select option when only one option is available and enableAll is true', async () => {
      const options = [{ label: 'A', value: 'a' }];
      render(<MultiCombobox width={200} options={options} onChange={jest.fn()} enableAllOption />);
      const input = screen.getByRole('combobox');
      await user.click(input);

      const checkbox = screen.getByTestId(`combobox-option-${options[0].value}-checkbox`);
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
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
      expect(screen.getByRole('option', { name: 'third' })).toBeInTheDocument();

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

    it('should allow deselecting items', async () => {
      const asyncOptions = jest.fn(() => Promise.resolve(simpleAsyncOptions));
      render(<MultiCombobox options={asyncOptions} value={['Option 1']} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Debounce
      await act(async () => jest.advanceTimersByTime(200));

      // Click on Option 1 to deselect it (it should already be selected via value prop)
      const item = await screen.findByRole('option', { name: 'Option 1' });
      await user.click(item);

      // Verify onChange was called to remove the item
      expect(onChangeHandler).toHaveBeenCalledWith([]);
    });

    it('should allow deselecting items with async options using ComboboxOption value format', async () => {
      // This test reproduces the bug where deselection doesn't work with async options
      // when the value is passed as ComboboxOption objects
      const asyncOptionsData = [
        { label: 'Integration A', value: 'a' },
        { label: 'Integration B', value: 'b' },
        { label: 'Integration C', value: 'c' },
      ];

      const asyncOptions = jest.fn(() => Promise.resolve(asyncOptionsData));

      // Use a controlled component to simulate the user's scenario
      const ControlledComponent = () => {
        const [selectedValue, setSelectedValue] = React.useState<Array<ComboboxOption<string>>>([
          { label: 'Integration A', value: 'a' },
        ]);

        return (
          <MultiCombobox
            options={asyncOptions}
            value={selectedValue}
            onChange={(options) => {
              onChangeHandler(options);
              setSelectedValue(options);
            }}
          />
        );
      };

      render(<ControlledComponent />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Wait for async options to load
      await act(async () => jest.advanceTimersByTime(200));

      // Integration A should be selected (shown as pill)
      const pillRemoveButton = screen.getByRole('button', { name: 'Remove Integration A' });
      expect(pillRemoveButton).toBeInTheDocument();

      // Click on Integration A in the dropdown to deselect it
      const item = await screen.findByRole('option', { name: 'Integration A' });
      await user.click(item);

      // Verify onChange was called to remove the item
      expect(onChangeHandler).toHaveBeenCalledWith([]);

      // The pill should be removed
      expect(screen.queryByRole('button', { name: 'Remove Integration A' })).not.toBeInTheDocument();
    });
  });
});

function promiseResolvesWith(value: ComboboxOption[], timeout = 0) {
  return new Promise<ComboboxOption[]>((resolve) => setTimeout(() => resolve(value), timeout));
}
