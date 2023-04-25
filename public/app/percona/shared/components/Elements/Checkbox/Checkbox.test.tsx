import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { dataQa, FormWrapper } from 'app/percona/shared/helpers/utils';

import { requiredTrue } from '../../../helpers/validatorsForm';

import { CheckboxField } from './CheckboxField';

const checkboxLabel = 'Checkbox label';

describe('CheckboxField::', () => {
  it('should render an input element of type checkbox', () => {
    render(
      <FormWrapper>
        <CheckboxField name="test" label="checkbox" />
      </FormWrapper>
    );

    // We can use either method: `toBeInTheDocument` or `toBeTruthy`
    expect(screen.getByRole('checkbox', { name: /checkbox/i })).toBeInTheDocument();
    expect(screen.getByTestId('test-checkbox-input')).toBeTruthy();
  });

  it('should call passed validators', () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn();

    render(
      <FormWrapper>
        <CheckboxField name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    expect(validatorOne).toBeCalledTimes(1);
    expect(validatorTwo).toBeCalledTimes(1);
  });

  it('should show an error on invalid status', async () => {
    const validatorOne = jest.fn().mockReturnValue('some error');
    const validatorTwo = jest.fn();

    render(
      <FormWrapper>
        <CheckboxField name="test" label="checkbox" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    const checkbox = await screen.getByRole('checkbox', { name: /checkbox/i });

    expect(screen.queryByText('some error')).not.toBeInTheDocument();

    expect(validatorOne).toBeCalledTimes(1);

    userEvent.click(checkbox);
    // In this case we need to fire `blur`, otherwise the error will not show up
    fireEvent.blur(checkbox);
    expect(validatorOne).toBeCalledTimes(1);
    expect(validatorTwo).toBeCalledTimes(0);

    expect(screen.getByText('some error')).toBeInTheDocument();
  });

  it('should show no labels if one is not specified', () => {
    render(
      <FormWrapper>
        <CheckboxField name="test" />
      </FormWrapper>
    );

    expect(screen.queryByTestId(dataQa('test-field-label'))).not.toBeInTheDocument();
  });

  it('should show a label if one is specified', () => {
    render(
      <FormWrapper>
        <CheckboxField label="test label" name="test" />
      </FormWrapper>
    );

    expect(screen.getByTestId('test-field-label')).toBeInTheDocument();
    expect(screen.getByText('test label')).toBeInTheDocument();
  });

  it('should accept any valid input html attributes and pass them over to the input tag', async () => {
    const title = 'Titolo di soggiorno';
    const onChange = jest.fn();

    render(
      <FormWrapper>
        <CheckboxField
          name="test"
          label={checkboxLabel}
          validators={[requiredTrue]}
          inputProps={{
            autoComplete: 'off',
            onChange,
            title,
          }}
        />
      </FormWrapper>
    );

    const checkbox = await screen.findByTestId('test-checkbox-input');

    expect(checkbox.getAttribute('autocomplete')).toEqual('off');

    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(checkbox.getAttribute('title')).toEqual(title);
  });
});
