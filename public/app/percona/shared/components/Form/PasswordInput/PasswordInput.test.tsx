import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { FormWrapper } from 'app/percona/shared/helpers/utils';

import { PasswordInputField } from './PasswordInputField';

describe('PasswordInputField::', () => {
  it('should render an input element of type password', async () => {
    render(
      <FormWrapper>
        <PasswordInputField name="test" />
      </FormWrapper>
    );

    const input = await screen.getByTestId('test-password-input');

    expect(input).toBeInTheDocument();
    expect(input).toHaveProperty('type', 'password');
  });

  it('should call passed validators', () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn();

    render(
      <FormWrapper>
        <PasswordInputField name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    expect(validatorOne).toBeCalledTimes(1);
    expect(validatorTwo).toBeCalledTimes(1);
  });

  it('should show an error on invalid input', async () => {
    const validatorOne = jest.fn().mockReturnValue('some error');
    const validatorTwo = jest.fn();

    render(
      <FormWrapper>
        <PasswordInputField name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    const input = await screen.getByTestId('test-password-input');

    expect(await screen.findByTestId('test-field-error-message')).toBeEmptyDOMElement();

    expect(validatorOne).toBeCalledTimes(1);

    fireEvent.change(input, { target: { value: 'Test' } });

    expect(validatorOne).toBeCalledTimes(2);
    expect(validatorTwo).toBeCalledTimes(0);

    expect(await screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
  });

  it('should show validation errors on blur if specified', async () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn().mockReturnValue('some error');

    render(
      <FormWrapper>
        <PasswordInputField showErrorOnBlur name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    const input = await screen.getByTestId('test-password-input');

    fireEvent.change(input, { target: { value: 'Test' } });

    expect(validatorOne).toBeCalledTimes(2);
    expect(validatorTwo).toBeCalledTimes(2);

    expect(await screen.findByTestId('test-field-error-message')).toBeEmptyDOMElement();

    fireEvent.blur(input);

    expect(await screen.findByTestId('test-field-error-message')).toHaveTextContent('some error');
  });

  it('should show validation errors on render if specified', async () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn().mockReturnValue('some error');

    render(
      <FormWrapper>
        <PasswordInputField showErrorOnRender name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    expect(validatorOne).toBeCalledTimes(1);
    expect(validatorTwo).toBeCalledTimes(1);

    expect(await screen.queryByText('some error')).toBeInTheDocument();
  });

  it('should show no labels if none are specified', async () => {
    render(
      <FormWrapper>
        <PasswordInputField name="test" />
      </FormWrapper>
    );

    expect(screen.queryByTestId('test-field-label')).not.toBeInTheDocument();
  });

  it('should show a label if one is specified', async () => {
    render(
      <FormWrapper>
        <PasswordInputField label="test label" name="test" />
      </FormWrapper>
    );

    expect(await screen.findByTestId('test-field-label')).toBeInTheDocument();
    expect(await screen.findByTestId('test-field-label')).toHaveTextContent('test label');
  });

  it('should show an asterisk on the label if the field is required', async () => {
    render(
      <FormWrapper>
        <PasswordInputField label="test label" name="test" required />
      </FormWrapper>
    );

    expect(await screen.findByTestId('test-field-label')).toBeInTheDocument();
    expect(await screen.findByTestId('test-field-label')).toHaveTextContent('test label *');
  });

  it('should not pass the required prop to the input if the field is required', async () => {
    render(
      <FormWrapper>
        <PasswordInputField name="test" required />
      </FormWrapper>
    );

    expect(await screen.getByTestId('test-password-input')).toHaveProperty('required', false);
  });

  it('should apply the passed class name to the inner input element', () => {
    const { container } = render(
      <FormWrapper>
        <PasswordInputField name="test" className="testClass" />
      </FormWrapper>
    );

    expect(container.querySelector('[data-testid="test-password-input"].testClass'));
  });

  it('should accept any valid input html attributes and pass them over to the input tag', async () => {
    const title = 'Titolo di stato';
    const onChange = jest.fn();

    render(
      <FormWrapper>
        <PasswordInputField
          name="test"
          inputProps={{
            autoComplete: 'off',
            onChange,
            title,
          }}
          initialValue="password"
        />
      </FormWrapper>
    );

    const input = await screen.getByTestId('test-password-input');

    expect(input).toHaveAttribute('value', 'password');

    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);

    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('title', title);
  });
});
