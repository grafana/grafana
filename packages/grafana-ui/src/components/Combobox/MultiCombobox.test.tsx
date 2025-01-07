import { render, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import React from 'react';

import { MultiCombobox, MultiComboboxProps } from './MultiCombobox';

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
    expect(await screen.findByText('B')).toBeInTheDocument();
    expect(await screen.findByText('C')).toBeInTheDocument();
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

    //Second option
    await user.click(screen.getByRole('option', { name: 'C' }));

    //Deselect
    await user.click(screen.getByRole('option', { name: 'A' }));

    expect(onChange).toHaveBeenNthCalledWith(1, [first]);
    expect(onChange).toHaveBeenNthCalledWith(2, [first, third]);
    expect(onChange).toHaveBeenNthCalledWith(3, [third]);
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
});
