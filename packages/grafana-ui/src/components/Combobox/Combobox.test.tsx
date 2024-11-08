import { act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Combobox, ComboboxOption } from './Combobox';

// Mock data for the Combobox options
const options: ComboboxOption[] = [
  { label: 'Option 1', value: '1' },
  { label: 'Option 2', value: '2' },
  { label: 'Option 3', value: '3', description: 'This is option 3' },
  { label: 'Option 4', value: '4' },
];

describe('Combobox', () => {
  const onChangeHandler = jest.fn();
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

  it('renders without error', () => {
    render(<Combobox options={options} value={null} onChange={onChangeHandler} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should allow selecting a value by clicking directly', async () => {
    render(<Combobox options={options} onChange={onChangeHandler} value={null} />);

    const input = screen.getByRole('combobox');
    await userEvent.click(input);

    const item = await screen.findByRole('option', { name: 'Option 1' });
    await userEvent.click(item);
    expect(screen.getByDisplayValue('Option 1')).toBeInTheDocument();
    expect(onChangeHandler).toHaveBeenCalledWith(options[0]);
  });

  it('selects value by clicking that needs scrolling', async () => {
    render(<Combobox options={options} value={null} onChange={onChangeHandler} />);

    await userEvent.click(screen.getByRole('combobox'));
    fireEvent.scroll(screen.getByRole('listbox'), { target: { scrollY: 200 } });
    await userEvent.click(screen.getByText('Option 4'));

    expect(screen.getByDisplayValue('Option 4')).toBeInTheDocument();
    expect(onChangeHandler).toHaveBeenCalledWith(options[3]);
  });

  it('selects value by searching and pressing enter', async () => {
    render(<Combobox options={options} value={null} onChange={onChangeHandler} />);

    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'Option 3');
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onChangeHandler).toHaveBeenCalledWith(options[2]);
    expect(screen.getByDisplayValue('Option 3')).toBeInTheDocument();
  });

  it('selects value by using keyboard only', async () => {
    render(<Combobox options={options} value={null} onChange={onChangeHandler} />);

    const input = screen.getByRole('combobox');
    await userEvent.click(input);

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // Focus is at index 0 to start with

    expect(onChangeHandler).toHaveBeenCalledWith(options[2]);
    expect(screen.queryByDisplayValue('Option 3')).toBeInTheDocument();
  });

  it('clears selected value', async () => {
    render(<Combobox options={options} value={options[1].value} onChange={onChangeHandler} isClearable />);

    expect(screen.queryByDisplayValue('Option 2')).toBeInTheDocument();
    const input = screen.getByRole('combobox');
    await userEvent.click(input);

    const clearButton = screen.getByTitle('Clear value');
    await userEvent.click(clearButton);

    expect(onChangeHandler).toHaveBeenCalledWith(null);
    expect(screen.queryByDisplayValue('Option 2')).not.toBeInTheDocument();
  });

  describe('create custom value', () => {
    it('should allow creating a custom value', async () => {
      const onChangeHandler = jest.fn();
      render(<Combobox options={options} value={null} onChange={onChangeHandler} createCustomValue />);
      const input = screen.getByRole('combobox');
      await userEvent.type(input, 'custom value');
      await userEvent.keyboard('{Enter}');

      expect(screen.getByDisplayValue('custom value')).toBeInTheDocument();
      expect(onChangeHandler).toHaveBeenCalledWith(expect.objectContaining({ value: 'custom value' }));
    });

    it('should proivde custom string when all options are numbers', async () => {
      const options = [
        { label: '1', value: 1 },
        { label: '2', value: 2 },
        { label: '3', value: 3 },
      ];

      const onChangeHandler = jest.fn();

      render(<Combobox options={options} value={null} onChange={onChangeHandler} createCustomValue />);
      const input = screen.getByRole('combobox');

      await userEvent.type(input, 'custom value');
      await userEvent.keyboard('{Enter}');

      expect(screen.getByDisplayValue('custom value')).toBeInTheDocument();
      expect(typeof onChangeHandler.mock.calls[0][0].value === 'string').toBeTruthy();
      expect(typeof onChangeHandler.mock.calls[0][0].value === 'number').toBeFalsy();

      await userEvent.click(input);
      await userEvent.keyboard('{Enter}'); // Select 1 as the first option
      expect(typeof onChangeHandler.mock.calls[1][0].value === 'string').toBeFalsy();
      expect(typeof onChangeHandler.mock.calls[1][0].value === 'number').toBeTruthy();
    });
  });

  describe('async', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeAll(() => {
      user = userEvent.setup({ delay: null });
    });

    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    // Assume that most apis only return with the value
    const simpleAsyncOptions = [{ value: 'Option 1' }, { value: 'Option 2' }, { value: 'Option 3' }];

    it('should allow async options', async () => {
      const asyncOptions = jest.fn(() => Promise.resolve(simpleAsyncOptions));
      render(<Combobox options={asyncOptions} value={null} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(asyncOptions).toHaveBeenCalled();
    });

    it('should allow async options and select value', async () => {
      const asyncOptions = jest.fn(() => Promise.resolve(simpleAsyncOptions));
      render(<Combobox options={asyncOptions} value={null} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      const item = await screen.findByRole('option', { name: 'Option 3' });
      await user.click(item);

      expect(onChangeHandler).toHaveBeenCalledWith(simpleAsyncOptions[2]);
      expect(screen.getByDisplayValue('Option 3')).toBeInTheDocument();
    });

    it('should ignore late responses', async () => {
      const asyncOptions = jest.fn(async (searchTerm: string) => {
        if (searchTerm === 'a') {
          return new Promise<ComboboxOption[]>((resolve) => setTimeout(() => resolve([{ value: 'first' }]), 1500));
        } else if (searchTerm === 'ab') {
          return new Promise<ComboboxOption[]>((resolve) => setTimeout(() => resolve([{ value: 'second' }]), 500));
        } else if (searchTerm === 'abc') {
          return new Promise<ComboboxOption[]>((resolve) => setTimeout(() => resolve([{ value: 'third' }]), 800));
        }
        return Promise.resolve([]);
      });

      render(<Combobox options={asyncOptions} value={null} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await act(async () => {
        await user.keyboard('a');
        jest.advanceTimersByTime(200); // Skip debounce
        await user.keyboard('b');
        jest.advanceTimersByTime(200); // Skip debounce
        await user.keyboard('c');
        jest.advanceTimersByTime(500); // Resolve the second request, should be ignored
      });

      let firstItem = screen.queryByRole('option', { name: 'first' });
      let secondItem = screen.queryByRole('option', { name: 'second' });
      let thirdItem = screen.queryByRole('option', { name: 'third' });

      expect(firstItem).not.toBeInTheDocument();
      expect(secondItem).not.toBeInTheDocument();
      expect(thirdItem).not.toBeInTheDocument();

      jest.advanceTimersByTime(800); // Resolve the third request, should be shown

      firstItem = screen.queryByRole('option', { name: 'first' });
      secondItem = screen.queryByRole('option', { name: 'second' });
      thirdItem = await screen.findByRole('option', { name: 'third' });

      expect(firstItem).not.toBeInTheDocument();
      expect(secondItem).not.toBeInTheDocument();
      expect(thirdItem).toBeInTheDocument();

      jest.advanceTimersByTime(1500); // Resolve the first request, should be ignored

      firstItem = screen.queryByRole('option', { name: 'first' });
      secondItem = screen.queryByRole('option', { name: 'second' });
      thirdItem = screen.queryByRole('option', { name: 'third' });

      expect(firstItem).not.toBeInTheDocument();
      expect(secondItem).not.toBeInTheDocument();
      expect(thirdItem).toBeInTheDocument();

      jest.clearAllTimers();
    });

    it('should debounce requests', async () => {
      const asyncSpy = jest.fn();
      const asyncOptions = jest.fn(async () => {
        return new Promise<ComboboxOption[]>(asyncSpy);
      });

      render(<Combobox options={asyncOptions} value={null} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(asyncSpy).toHaveBeenCalledTimes(1); // Called on open
      asyncSpy.mockClear();

      await user.keyboard('a');
      await act(async () => jest.advanceTimersByTime(10));

      await user.keyboard('b');
      await act(async () => jest.advanceTimersByTime(10));

      await user.keyboard('c');
      await act(async () => jest.advanceTimersByTime(200));

      expect(asyncSpy).toHaveBeenCalledTimes(1); // Called only for 'abc'
    });

    it('should allow custom value while async is being run', async () => {
      const asyncOptions = jest.fn(async () => {
        return new Promise<ComboboxOption[]>((resolve) => setTimeout(() => resolve([{ value: 'first' }]), 2000));
      });

      render(<Combobox options={asyncOptions} value={null} onChange={onChangeHandler} createCustomValue />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await act(async () => {
        await user.type(input, 'fir');
        jest.advanceTimersByTime(500); // Custom value while typing
      });

      const customItem = screen.queryByRole('option', { name: 'fir Create custom value' });

      expect(customItem).toBeInTheDocument();
    });

    it('should display message when there is an error loading async options', async () => {
      const asyncOptions = jest.fn(() => {
        throw new Error('Could not retrieve options');
      });

      render(<Combobox options={asyncOptions} value={null} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'test');

      await act(async () => {
        jest.advanceTimersToNextTimer();
      });

      const emptyMessage = screen.queryByText('An error occurred while loading options.');

      expect(emptyMessage).toBeInTheDocument();
    });
  });
});
