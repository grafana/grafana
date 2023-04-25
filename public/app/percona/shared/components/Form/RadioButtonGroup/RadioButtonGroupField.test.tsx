import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { FormWrapper } from 'app/percona/shared/helpers/utils';

import { RadioButtonGroupField } from './RadioButtonGroupField';

const options = [
  { label: 'Lowest', value: 'lowest', icon: 'bolt' },
  { label: 'Medium', value: 'medium', icon: 'arrow-right' },
  { label: 'High', value: 'high', icon: 'arrow-up' },
  { label: 'Highest', value: 'highest', icon: 'cloud' },
];

const initialValues = { test: 'lowest' };

describe('RadioButtonGroupField::', () => {
  it('should render as many RadioButtons as there are options', async () => {
    render(
      <FormWrapper>
        <RadioButtonGroupField name="test" options={options} />
      </FormWrapper>
    );

    const buttons = await screen.getAllByTestId('test-radio-button');

    expect(buttons).toHaveLength(4);
    expect(buttons[0]).toHaveProperty('type', 'radio');
    expect(await screen.getByLabelText('Lowest')).toBeInTheDocument();
    expect(await screen.getByLabelText('Medium')).toBeInTheDocument();
    expect(await screen.getByLabelText('High')).toBeInTheDocument();
    expect(await screen.getByLabelText('Highest')).toBeInTheDocument();
  });

  it('should call the validators passed in props', () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn();

    render(
      <FormWrapper>
        <RadioButtonGroupField name="test" options={options} validators={[validatorOne, validatorTwo]} />
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
        <RadioButtonGroupField name="test" options={options} validators={[validatorOne, validatorTwo]} />
      </FormWrapper>
    );

    const state = await screen.getByTestId('test-radio-state');

    expect(screen.getByTestId('test-field-error-message')).toBeEmptyDOMElement();

    expect(validatorOne).toBeCalledTimes(1);

    fireEvent.change(state, { target: { value: 'Test' } });

    expect(validatorOne).toBeCalledTimes(2);
    expect(validatorTwo).toBeCalledTimes(0);

    expect(await screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
  });

  it('should show validation errors on blur if specified', async () => {
    const validatorOne = jest.fn();
    const validatorTwo = jest.fn().mockReturnValue('some error');

    render(
      <FormWrapper>
        <RadioButtonGroupField
          showErrorOnBlur
          name="test"
          options={options}
          validators={[validatorOne, validatorTwo]}
        />
      </FormWrapper>
    );

    const state = await screen.getByTestId('test-radio-state');

    fireEvent.change(state, { target: { value: 'Test' } });

    expect(validatorOne).toBeCalledTimes(2);
    expect(validatorTwo).toBeCalledTimes(2);

    expect(await screen.getByTestId('test-field-error-message')).toBeEmptyDOMElement();

    fireEvent.blur(state);

    expect(await screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
  });

  it('should show no labels if none are passed via props', async () => {
    render(
      <FormWrapper>
        <RadioButtonGroupField name="test" options={options} />
      </FormWrapper>
    );

    expect(await screen.queryByTestId('test-field-label')).not.toBeInTheDocument();
  });

  it('should show a label if one is passed via props', async () => {
    render(
      <FormWrapper>
        <RadioButtonGroupField label="test label" name="test" options={options} />
      </FormWrapper>
    );

    expect(await screen.getByTestId('test-field-label')).toBeInTheDocument();
    expect(await screen.getByTestId('test-field-label')).toHaveTextContent('test label');
  });

  it('should show an asterisk on the label if the field is required', async () => {
    render(
      <FormWrapper>
        <RadioButtonGroupField label="test label" name="test" options={options} required />
      </FormWrapper>
    );

    expect(await screen.getByTestId('test-field-label')).toBeInTheDocument();
    expect(await screen.getByTestId('test-field-label')).toHaveTextContent('test label *');
  });

  it('should change the state value when clicked on a different radio button', async () => {
    render(
      <FormWrapper initialValues={initialValues}>
        <RadioButtonGroupField name="test" options={options} />
      </FormWrapper>
    );

    const state = await screen.getByTestId('test-radio-state');
    const buttons = await screen.getAllByTestId('test-radio-button');

    expect(state).toHaveProperty('value', 'lowest');
    expect(buttons[0]).toHaveProperty('checked', true);

    fireEvent.click(buttons[1]);
    expect(state).toHaveProperty('value', 'medium');
    expect(buttons[1]).toHaveProperty('checked', true);
  });

  it('should disable all radio buttons when `disabled` is passed via props', async () => {
    render(
      <FormWrapper initialValues={initialValues}>
        <RadioButtonGroupField name="test" options={options} disabled />
      </FormWrapper>
    );

    const state = await screen.getByTestId('test-radio-state');
    const buttons = await screen.getAllByTestId('test-radio-button');

    expect(state).toHaveProperty('value', 'lowest');
    expect(state).toHaveProperty('disabled', false);
    expect(buttons[0]).toHaveProperty('checked', true);
    expect(buttons[2]).toHaveProperty('disabled', true);
    fireEvent.click(buttons[2]);

    // The value shouldn't have changed since the component disallows clicks when disabled
    expect(state).toHaveProperty('value', 'lowest');
    expect(buttons[0]).toHaveProperty('checked', true);
  });

  it('should apply the passed class name to the wrapper', async () => {
    const { container } = render(
      <FormWrapper>
        <RadioButtonGroupField name="test" options={options} className="testClass" />
      </FormWrapper>
    );

    expect(container.querySelector('div.testClass')).toBeInTheDocument();
  });

  xit('should trigger a change event when clicking on arrow buttons', async () => {
    render(
      <FormWrapper initialValues={initialValues}>
        <RadioButtonGroupField name="test" options={options} />
      </FormWrapper>
    );

    const state = await screen.getByTestId('test-radio-state');
    const buttons = await screen.getAllByTestId('test-radio-button');

    expect(state).toHaveProperty('value', 'lowest');
    expect(buttons[0]).toHaveProperty('checked', true);

    const lowestLabel = await screen.getByLabelText('Lowest');
    const highLabel = await screen.getByLabelText('High');

    fireEvent.focus(lowestLabel);
    fireEvent.keyDown(lowestLabel, { key: 'ArrowRight', code: 'ArrowRight' });
    fireEvent.focus(highLabel);
    fireEvent.keyDown(highLabel, { key: 'ArrowRight' });

    // The value should change since the component supports triggering changes on arrow keystrokes
    expect(state).toHaveProperty('value', 'high');
    expect(buttons[0]).toHaveProperty('checked', false);
  });

  it('should accept any valid input html attributes and pass them over to all inputs except state', async () => {
    const title = 'Arbitrary test title';
    const onBlur = jest.fn();

    render(
      <FormWrapper>
        <RadioButtonGroupField
          name="test"
          inputProps={{
            onBlur,
            title,
          }}
          options={options}
        />
      </FormWrapper>
    );

    const buttons = await screen.getAllByTestId('test-radio-button');

    fireEvent.focus(buttons[1]);
    fireEvent.blur(buttons[1]);

    expect(buttons[0]).toHaveAttribute('title', title);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
