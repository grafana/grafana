import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { FormWrapper } from 'app/percona/shared/helpers/utils';

import { SwitchField } from './Switch';

describe('SwitchField::', () => {
  it('should render an input element of type checkbox', () => {
    render(
      <FormWrapper>
        <SwitchField name="test" />
      </FormWrapper>
    );

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
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

  it('should show a label if one is specified', async () => {
    render(
      <FormWrapper>
        <SwitchField label="test label" name="test" />
      </FormWrapper>
    );

    expect(screen.getByTestId('test-field-label').textContent).toBe('test label');
  });

  it('should change the state value when clicked', async () => {
    render(
      <FormWrapper>
        <SwitchField name="test" />
      </FormWrapper>
    );
    const switchField = screen.getByTestId('test-switch');

    expect(switchField).toHaveProperty('checked', false);

    fireEvent.change(switchField, { target: { checked: true } });

    expect(switchField).toHaveProperty('checked', true);
  });

  it('should disable switch when `disabled` is passed via props', () => {
    render(
      <FormWrapper>
        <SwitchField name="test" disabled />
      </FormWrapper>
    );

    expect(screen.getByRole('checkbox')).toHaveProperty('disabled', true);
  });
});
