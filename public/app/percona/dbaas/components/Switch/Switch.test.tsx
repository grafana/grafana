import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { FormWrapper } from 'app/percona/shared/helpers/utils';

import { SwitchField } from './Switch';

describe('SwitchField::', () => {
  it('should render an input element of type checkbox', async () => {
    render(
      <FormWrapper>
        <SwitchField name="test" />
      </FormWrapper>
    );

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('test-switch')).toBeInTheDocument();
  });

  it('should call passed validators', () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn();

    render(
      <FormWrapper>
        <SwitchField name="test" validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    expect(validatorOne).toBeCalledTimes(1);
    expect(validatorTwo).toBeCalledTimes(1);
  });

  it('should show no labels if one is not specified', () => {
    render(
      <FormWrapper>
        <SwitchField name="test" />
      </FormWrapper>
    );

    expect(screen.queryByTestId('test-field-label')).not.toBeInTheDocument();
  });

  it('should show a label if one is specified', () => {
    render(
      <FormWrapper>
        <SwitchField label="test label" name="test" />
      </FormWrapper>
    );

    expect(screen.getByTestId('test-field-label')).toBeInTheDocument();
    expect(screen.getByTestId('test-field-label')).toHaveTextContent('test label');
  });

  it('should change the state value when clicked', async () => {
    render(
      <FormWrapper>
        <SwitchField name="test" />
      </FormWrapper>
    );

    expect(screen.getByTestId('test-switch')).toHaveProperty('value', 'on');

    const checkbox = screen.getByRole('checkbox');
    await waitFor(() => fireEvent.change(checkbox, { target: { value: true } }));

    expect(screen.getByTestId('test-switch')).toHaveProperty('value', 'true');
  });

  it('should disable switch when `disabled` is passed via props', () => {
    render(
      <FormWrapper>
        <SwitchField name="test" disabled />
      </FormWrapper>
    );

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
