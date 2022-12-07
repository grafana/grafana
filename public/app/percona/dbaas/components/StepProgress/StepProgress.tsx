/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { LoaderButton } from '@percona/platform-core';
import { FormApi } from 'final-form';
import React, { FC, ReactNode, useCallback, useState } from 'react';
import { Form, FormRenderProps } from 'react-final-form';

import { HorizontalGroup, useStyles } from '@grafana/ui';

import { AddDBClusterFields } from '../DBCluster/EditDBClusterPage/EditDBClusterPage.types';
import { generateUID } from '../DBCluster/EditDBClusterPage/EditDBClusterPage.utils';

import { Step, StepStatus } from './Step/Step';
import { getStyles } from './StepProgress.styles';

export interface StepProgressProps {
  steps: StepProps[];
  initialValues?: Record<string, any>;
  submitButtonMessage: string;
  onSubmit: (values: Record<string, any>) => void;
  loading: boolean;
}

export interface StepProps {
  render: (props: FormRenderProps) => ReactNode;
  title?: string;
  fields: string[];
  dataTestId?: string;
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

export const StepProgress: FC<StepProgressProps> = ({
  steps,
  initialValues,
  submitButtonMessage,
  onSubmit,
  loading,
}) => {
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
      mutators={{
        setClusterName: (databaseTypeValue: string, state, { changeValue }) => {
          changeValue(state, `${AddDBClusterFields.name}`, () => `${databaseTypeValue}-${generateUID()}`);
        },
      }}
      render={({ form, handleSubmit, valid, pristine, ...props }) => (
        <form onSubmit={handleSubmit} className={styles.stepProgressWrapper} data-testid="step-progress">
          {steps.map(({ render, title, fields, dataTestId }, index) => (
            <Step
              key={index}
              title={title}
              number={index + 1}
              onClick={onClick(index)}
              status={getStepStatus(form, fields, currentStep, index, stepsVisited)}
              isLast={index === steps.length - 1}
              dataTestId={dataTestId}
            >
              {render({
                form,
                handleSubmit,
                valid,
                pristine,
                ...props,
              })}
            </Step>
          ))}
          <HorizontalGroup justify="center" spacing="md">
            <LoaderButton
              data-testid="step-progress-submit-button"
              size="md"
              variant="primary"
              disabled={!valid || pristine || loading}
              loading={loading}
              className={styles.createButton}
              type="submit"
            >
              {submitButtonMessage}
            </LoaderButton>
          </HorizontalGroup>
        </form>
      )}
    />
  );
};
