import React, { FC, ReactNode, useCallback, useState } from 'react';
import { Form, FormRenderProps } from 'react-final-form';
import { FormApi } from 'final-form';
import { HorizontalGroup, useStyles } from '@grafana/ui';
import { LoaderButton } from '@percona/platform-core';
import { Step, StepStatus } from './Step/Step';
import { getStyles } from './StepProgress.styles';

export interface StepProgressProps {
  steps: StepProps[];
  initialValues?: Record<string, any>;
  submitButtonMessage: string;
  onSubmit: (values: Record<string, any>) => void;
}

export interface StepProps {
  render: (props: FormRenderProps) => ReactNode;
  title?: string;
  fields: string[];
  dataQa?: string;
}

const getStepStatus = (
  form: FormApi,
  fields: string[],
  currentStep: number,
  index: number,
  stepsVisited: number[]
): StepStatus => {
  if (currentStep === index) {
    return StepStatus.current;
  }

  const valid = fields.find((field) => form.getFieldState(field)?.invalid) === undefined;
  const visited = stepsVisited.includes(index);

  if (visited) {
    return valid ? StepStatus.done : StepStatus.invalid;
  }

  return StepStatus.todo;
};

export const StepProgress: FC<StepProgressProps> = ({ steps, initialValues, submitButtonMessage, onSubmit }) => {
  const styles = useStyles(getStyles);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsVisited, setStepsVisited] = useState([currentStep]);
  const onClick = useCallback(
    (index: number) => () => {
      setCurrentStep(index);
      setStepsVisited([...stepsVisited, index]);
    },
    [stepsVisited]
  );

  return (
    <Form
      initialValues={initialValues}
      onSubmit={onSubmit}
      render={({ form, handleSubmit, valid, pristine, submitting, ...props }) => (
        <form onSubmit={handleSubmit} className={styles.stepProgressWrapper} data-qa="step-progress">
          {steps.map(({ render, title, fields, dataQa }, index) => (
            <Step
              key={index}
              title={title}
              number={index + 1}
              onClick={onClick(index)}
              status={getStepStatus(form, fields, currentStep, index, stepsVisited)}
              isLast={index === steps.length - 1}
              dataQa={dataQa}
            >
              {render({
                form,
                handleSubmit,
                valid,
                pristine,
                submitting,
                ...props,
              })}
            </Step>
          ))}
          <HorizontalGroup justify="center" spacing="md">
            <LoaderButton
              data-qa="step-progress-submit-button"
              size="md"
              variant="primary"
              disabled={!valid || pristine || submitting}
              loading={submitting}
              className={styles.createButton}
            >
              {submitButtonMessage}
            </LoaderButton>
          </HorizontalGroup>
        </form>
      )}
    />
  );
};
