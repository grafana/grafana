import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { FormWrapper } from 'app/percona/shared/helpers/utils';

import { TextareaInputField } from './TextareaInputField';

describe('TextareaInputField::', () => {
  it('should render a textarea element', () => {
    render(
      <FormWrapper>
        <TextareaInputField name="test" />
      </FormWrapper>
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should call passed validators', () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn();

    render(
      <FormWrapper>
        <TextareaInputField name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    expect(validatorOne).toBeCalledTimes(1);
    expect(validatorTwo).toBeCalledTimes(1);
  });

  it('should show an error on invalid input', () => {
    const validatorOne = jest.fn().mockReturnValue('some error');
    const validatorTwo = jest.fn();

    render(
      <FormWrapper>
        <TextareaInputField name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    expect(screen.getByTestId('test-field-error-message')).toBeEmptyDOMElement();

    expect(validatorOne).toBeCalledTimes(1);

    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Test' } });

    expect(validatorOne).toBeCalledTimes(2);
    expect(validatorTwo).toBeCalledTimes(0);

    expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
  });

  it('should show validation errors on blur if specified', () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn().mockReturnValue('some error');

    render(
      <FormWrapper>
        <TextareaInputField showErrorOnBlur name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Test' } });

    expect(validatorOne).toBeCalledTimes(2);
    expect(validatorTwo).toBeCalledTimes(2);

    expect(screen.getByTestId('test-field-error-message')).toBeEmptyDOMElement();

    fireEvent.blur(input);

    expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
  });

  it('should show validation errors on render if specified', async () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn().mockReturnValue('some error');

    render(
      <FormWrapper>
        <TextareaInputField showErrorOnRender name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    expect(validatorOne).toBeCalledTimes(1);
    expect(validatorTwo).toBeCalledTimes(1);

    expect(await screen.queryByText('some error')).toBeInTheDocument();
  });

  it('should show no labels if none are passed to props', () => {
    render(
      <FormWrapper>
        <TextareaInputField name="test" />
      </FormWrapper>
    );

    expect(screen.queryByTestId('test-field-label')).not.toBeInTheDocument();
  });

  it('should show a label if one is specified', () => {
    render(
      <FormWrapper>
        <TextareaInputField label="test label" name="test" />
      </FormWrapper>
    );

    expect(screen.queryByTestId('test-field-label')).toHaveTextContent('test label');
  });

  it('should show an asterisk on the label if the field is required', () => {
    render(
      <FormWrapper>
        <TextareaInputField label="test label" name="test" required />
      </FormWrapper>
    );

    expect(screen.queryByTestId('test-field-label')).toHaveTextContent('test label *');
  });

  it('should not pass the required prop to the input if the field is required', () => {
    render(
      <FormWrapper>
        <TextareaInputField name="test" required />
      </FormWrapper>
    );

    expect(screen.getByRole('textbox')).not.toHaveAttribute('required', true);
  });

  it('should apply the passed class name to the inner textarea element', () => {
    render(
      <FormWrapper>
        <TextareaInputField name="test" className="testClass" />
      </FormWrapper>
    );

    expect(screen.getByRole('textbox').classList.contains('testClass'));
  });

  it('should accept any valid input html attributes and pass them over to the textarea tag', () => {
    const title = 'Titolo di studio';
    const onChange = jest.fn();

    render(
      <FormWrapper>
        <TextareaInputField
          name="test"
          inputProps={{
            autoComplete: 'off',
            onChange,
            title,
          }}
        />
      </FormWrapper>
    );

    const input = screen.getByTestId('test-textarea-input');

    fireEvent.change(input, { target: { value: 'foo' } });

    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('title', title);
  });
});
