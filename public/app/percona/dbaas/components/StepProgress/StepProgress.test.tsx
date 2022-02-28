/* eslint-disable react/display-name */
import React from 'react';
import { LoaderButton, TextInputField, TextareaInputField } from '@percona/platform-core';
import { StepProgress } from './StepProgress';
import { render, fireEvent, screen } from '@testing-library/react';

describe('StepProgress::', () => {
  const steps = [
    {
      render: () => (
        <div>
          <TextInputField name="name" />
          <TextInputField name="email" />
        </div>
      ),
      fields: ['name', 'email'],
      dataTestId: 'step-1',
    },
    {
      render: () => (
        <div>
          <TextareaInputField name="description" />
          <LoaderButton type="submit" />
        </div>
      ),
      fields: ['description'],
      dataTestId: 'step-2',
    },
  ];

  const isCurrentStep = (dataTestId: string) => {
    const stepContent = screen.getByTestId(`${dataTestId}`).querySelector('[data-testid="step-content"]');
    return stepContent ? stepContent.getElementsByTagName('div')[0].className.split('-')?.includes('current') : false;
  };

  it('renders steps correctly', () => {
    render(<StepProgress steps={steps} submitButtonMessage="Confirm" onSubmit={() => {}} />);
    const a = screen.queryAllByRole('textbox');
    expect(a.filter((item) => item.tagName === 'INPUT')).toHaveLength(2);
    expect(a.filter((item) => item.tagName === 'TEXTAREA')).toHaveLength(1);

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByTestId('step-header')).toHaveLength(2);
    expect(isCurrentStep('step-1')).toBeTruthy();
  });

  it('renders steps correctly with initial values', () => {
    render(
      <StepProgress
        steps={steps}
        submitButtonMessage="Confirm"
        onSubmit={() => {}}
        initialValues={{
          name: 'Test name',
          description: 'Test description',
        }}
      />
    );

    expect(screen.getByTestId('name-text-input')).toHaveValue('Test name');
    expect(screen.getByTestId('description-textarea-input')).toHaveValue('Test description');
  });

  it('changes current step correctly', () => {
    render(<StepProgress steps={steps} submitButtonMessage="Confirm" onSubmit={() => {}} />);

    expect(isCurrentStep('step-1')).toBeTruthy();

    const stepHeader = screen.getByTestId('step-2').querySelector('[data-testid="step-header"]');
    expect(stepHeader).toBeTruthy();
    if (stepHeader) {
      fireEvent.click(stepHeader);
    }

    expect(isCurrentStep('step-1')).toBeFalsy();
    expect(isCurrentStep('step-2')).toBeTruthy();
  });

  it('calls submit correctly', () => {
    const onSubmit = jest.fn();
    render(
      <StepProgress
        steps={steps}
        submitButtonMessage="Confirm"
        onSubmit={onSubmit}
        initialValues={{
          name: 'Test name',
          description: 'Test description',
        }}
      />
    );

    const email = screen.getByTestId('email-text-input');
    fireEvent.change(email, { target: { value: 'test@test.com' } });

    const form = screen.getByTestId('step-progress');
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalled();
  });
});
