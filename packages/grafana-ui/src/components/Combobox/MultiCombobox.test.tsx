import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { MultiCombobox, MultiComboboxProps } from './MultiCombobox';

describe('MultiCombobox', () => {
  it('should render with options', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    render(<MultiCombobox options={options} value={[]} onChange={jest.fn()} />);
    const input = screen.getByRole('combobox');
    userEvent.click(input);
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
    const { getByText } = render(<MultiCombobox options={options} value={['a']} onChange={jest.fn()} />);
    expect(getByText('A')).toBeInTheDocument();
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
    await userEvent.click(input);
    await userEvent.click(await screen.findByRole('option', { name: 'A' }));

    //Second option
    //await userEvent.click(input);
    await userEvent.click(await screen.findByRole('option', { name: 'C' }));

    //Deselect
    //userEvent.click(input);
    await userEvent.click(await screen.findByRole('option', { name: 'A' }));

    expect(onChange).toHaveBeenNthCalledWith(1, [first]);
    expect(onChange).toHaveBeenNthCalledWith(2, [first, third]);
    expect(onChange).toHaveBeenNthCalledWith(3, [third]);
  });

  it('should be able to render a valie that is not in the options', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    render(<MultiCombobox options={options} value={['a', 'd', 'c']} onChange={jest.fn()} />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByText('d')).toBeInTheDocument();
  });
});
