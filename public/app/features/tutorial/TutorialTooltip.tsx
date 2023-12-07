import { css } from '@emotion/css';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { TutorialProgress } from 'app/features/tutorial/TutorialProgress';
import { StoreState, useDispatch } from 'app/types';

import { exitCurrentTutorial, nextStep } from './slice';
import { type Step } from './types';

const TutorialTooltipComponent = ({
  availableTutorials,
  currentTutorialId,
  currentStepIndex,
}: ConnectedProps<typeof connector>) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const currentTutorial = availableTutorials.find((t) => t.id === currentTutorialId);
  const isLastStep = currentTutorial ? currentStepIndex === currentTutorial.steps.length - 1 : false;
  const step = currentStepIndex !== null && currentTutorial ? currentTutorial.steps[currentStepIndex] : null;

  if (step && currentTutorial && currentStepIndex !== null) {
    return (
      <>
        <StepTitle title={step.title} />
        <StepContent content={step.content} />
        <Stack alignItems={`center`} justifyContent={`space-between`}>
          <StepActions isLastStep={isLastStep} step={step} />
          <TutorialProgress currentStep={currentStepIndex} totalSteps={currentTutorial.steps.length} />
        </Stack>
        <IconButton
          className={styles.exit}
          name="times"
          onClick={() => {
            dispatch(exitCurrentTutorial());
          }}
          tooltip="Exit tutorial"
        />
      </>
    );
  }

  return null;
};

const StepTitle = ({ title }: { title: Step['title'] }) => {
  if (!title) {
    return null;
  }

  if (typeof title === 'string') {
    return (
      <Text element="h2" variant="h6">
        {title}
      </Text>
    );
  }

  return <div>{title}</div>;
};

const StepContent = ({ content }: { content: Step['content'] }) => {
  if (!content) {
    return null;
  }

  if (typeof content === 'string') {
    return <div>{content}</div>;
  }

  return <div>{content}</div>;
};

const StepActions = ({ isLastStep, step }: { isLastStep: boolean; step: Step }) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  if (step.requiredActions) {
    return <div className={styles.required}>{`Required action${isLastStep ? ' to finish' : ``}`}</div>;
  }

  return (
    <div>
      <Button onClick={() => dispatch(nextStep())}>{isLastStep ? 'Finish' : 'Next'}</Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  exit: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
  }),
  required: css({
    fontStyle: `italic`,
    color: `#a28900`,
  }),
});

TutorialTooltipComponent.displayName = 'TutorialTooltip';

const mapStateToProps = (state: StoreState) => {
  return {
    ...state.tutorials,
  };
};

const connector = connect(mapStateToProps);

export const TutorialTooltip = connector(TutorialTooltipComponent);
