import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';

import { withFilterTypes } from './withFilterTypes';

interface FormValues {
  categories: string[];
  name: string;
}

describe('withFilterTypes', () => {
  it('should be collapsed if isOpen is not passed', () => {
    const Filters = withFilterTypes<FormValues>();

    render(
      <Filters onApply={jest.fn()}>
        <TextInputField name="name" label="Name" />
        <RadioButtonGroupField
          options={[
            { label: 'Foo', value: 'foo' },
            { label: 'Bar', value: 'bar' },
          ]}
          name="status"
          disabled
          label="Status"
          defaultValue="all"
        />
      </Filters>
    );

    expect(screen.queryByTestId('name-text-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-radio-state')).not.toBeInTheDocument();
  });

  it('should render form fields when open', () => {
    const Filters = withFilterTypes<FormValues>();

    render(
      <Filters isOpen onApply={jest.fn()}>
        <TextInputField name="name" label="Name" />
        <RadioButtonGroupField
          options={[
            { label: 'Foo', value: 'foo' },
            { label: 'Bar', value: 'bar' },
          ]}
          name="status"
          disabled
          label="Status"
          defaultValue="all"
        />
      </Filters>
    );

    expect(screen.getByTestId('name-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('status-radio-state')).toBeInTheDocument();
  });

  it('should attach class names to form', () => {
    const Filters = withFilterTypes<FormValues>();

    render(<Filters isOpen className="foo-class" onApply={jest.fn()}></Filters>);

    expect(screen.getByRole('form')).toHaveClass('foo-class');
  });

  it('should call onApply with form values', () => {
    const Filters = withFilterTypes<FormValues>();
    const onApply = jest.fn();

    render(
      <Filters isOpen onApply={onApply}>
        <TextInputField name="name" label="Name" />
        <TextInputField name="surname" label="Surname" />
      </Filters>
    );

    fireEvent.input(screen.getByTestId('name-text-input'), { target: { value: 'John' } });
    fireEvent.input(screen.getByTestId('surname-text-input'), { target: { value: 'Doe' } });
    fireEvent.submit(screen.getByRole('form'));
    expect(onApply).toHaveBeenCalledWith({ name: 'John', surname: 'Doe' }, expect.anything(), expect.anything());
  });
});
