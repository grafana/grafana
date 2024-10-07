import { render, screen, fireEvent } from '@testing-library/react';
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
      expect(onChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'custom value', value: 'custom value' })
      );
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
    beforeEach(() => {
      jest.useFakeTimers();
    });

    // Assume that most apis only return with the value
    const simpleAsyncOptions = [{ value: 'Option 1' }, { value: 'Option 2' }, { value: 'Option 3' }];

    it('should allow async options', async () => {
      const asyncOptions = jest.fn(() => Promise.resolve(simpleAsyncOptions));
      render(<Combobox options={asyncOptions} value={null} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await userEvent.click(input, { delay: null });

      expect(asyncOptions).toHaveBeenCalled();
      //expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('should allow async options and select value', async () => {
      const asyncOptions = jest.fn(() => Promise.resolve(simpleAsyncOptions));
      render(<Combobox options={asyncOptions} value={null} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await userEvent.click(input, { delay: null });

      const item = await screen.findByRole('option', { name: 'Option 3' });
      await userEvent.click(item, { delay: null });

      expect(onChangeHandler).toHaveBeenCalledWith(simpleAsyncOptions[2]);
      expect(screen.getByDisplayValue('Option 3')).toBeInTheDocument();
    });

    it('should ignore late responses', async () => {
      const asyncOptions = jest.fn(async (searchTerm: string) => {
        //console.log('called with ', searchTerm);
        if (searchTerm === 'a') {
          return new Promise((resolve) => setTimeout(() => resolve([{ value: 'first' }]), 1000));
        } else if (searchTerm === 'ab') {
          return new Promise((resolve) => setTimeout(() => resolve([{ value: 'second' }]), 200));
        }
        return Promise.resolve([]);
      });
      //@ts-ignore
      render(<Combobox options={asyncOptions} value={null} onChange={onChangeHandler} />);

      const input = screen.getByRole('combobox');
      await userEvent.click(input, { delay: null }); // First request

      await userEvent.keyboard('ab', { delay: null }); // Second request
      jest.advanceTimersByTime(210); // Resolve the second request

      let item = await screen.findByRole('option', { name: 'second' });
      let firstItem = screen.queryByRole('option', { name: 'first' });

      expect(item).toBeInTheDocument();
      expect(firstItem).not.toBeInTheDocument();

      jest.advanceTimersByTime(1100); // Resolve the first request

      item = await screen.findByRole('option', { name: 'second' });
      firstItem = screen.queryByRole('option', { name: 'first' });

      //screen.debug();
      expect(firstItem).not.toBeInTheDocument();
      expect(item).toBeInTheDocument();
    });
  });
});
