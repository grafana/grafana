import React from 'react';
import { render, screen } from '@testing-library/react';
import { Select, InlineField } from '@grafana/ui';
import { useCreatableSelectPersistedBehaviour } from './useCreatableSelectPersistedBehaviour';
import userEvent from '@testing-library/user-event';

describe('useCreatableSelectPersistedBehaviour', () => {
  it('Should make a Select accept custom values', () => {
    const MyComp = (_: { force?: boolean }) => (
      <InlineField label="label">
        <Select
          menuShouldPortal
          inputId="select"
          {...useCreatableSelectPersistedBehaviour({
            options: [{ label: 'Option 1', value: 'Option 1' }],
            onChange() {},
          })}
        />
      </InlineField>
    );

    const { rerender } = render(<MyComp />);

    const input = screen.getByLabelText('label') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    // we open the menu
    userEvent.click(input);

    expect(screen.getByText('Option 1')).toBeInTheDocument();

    // we type in the input 'Option 2', which should prompt an option creation
    userEvent.type(input, 'Option 2');
    const creatableOption = screen.getByLabelText('Select option');
    expect(creatableOption).toHaveTextContent('Create: Option 2');

    // we click on the creatable option to trigger its creation
    userEvent.click(creatableOption);

    // Forcing a rerender
    rerender(<MyComp force={true} />);

    // we open the menu again
    userEvent.click(input);
    // the created option should be available
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('Should handle onChange properly', () => {
    const onChange = jest.fn();
    const MyComp = () => (
      <InlineField label="label">
        <Select
          menuShouldPortal
          inputId="select"
          {...useCreatableSelectPersistedBehaviour({
            options: [{ label: 'Option 1', value: 'Option 1' }],
            onChange,
          })}
        />
      </InlineField>
    );

    render(<MyComp />);

    const input = screen.getByLabelText('label') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    // we open the menu
    userEvent.click(input);

    const option1 = screen.getByText('Option 1');
    expect(option1).toBeInTheDocument();

    // Should call onChange when selecting an already existing option
    userEvent.click(option1);
    expect(onChange).toHaveBeenCalledWith('Option 1');

    userEvent.click(input);

    // we type in the input 'Option 2', which should prompt an option creation
    userEvent.type(input, 'Option 2');
    userEvent.click(screen.getByLabelText('Select option'));

    expect(onChange).toHaveBeenCalledWith('Option 2');
  });

  it('Should create an option for value if value is not in options', () => {
    const MyComp = (_: { force?: boolean }) => (
      <InlineField label="label">
        <Select
          menuShouldPortal
          inputId="select"
          {...useCreatableSelectPersistedBehaviour({
            options: [{ label: 'Option 1', value: 'Option 1' }],
            value: 'Option 2',
            onChange() {},
          })}
        />
      </InlineField>
    );

    render(<MyComp />);

    const input = screen.getByLabelText('label') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    // we open the menu
    userEvent.click(input);

    // we expect 2 elemnts having "Option 2": the input itself and the option.
    expect(screen.getAllByText('Option 2')).toHaveLength(2);
  });
});
