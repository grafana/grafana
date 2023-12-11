import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, type IconName, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { TutorialProgress } from 'app/features/tutorial/TutorialProgress';
import { StoreState, useDispatch } from 'app/types';

import { exitCurrentTutorial, nextStep } from './slice';
import { RequiredAction, type Step } from './types';

const TutorialTooltipComponent = ({
  availableTutorials,
  currentTutorialId,
  currentStepIndex,
  currentCompletedActions,
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
          <StepActions currentCompletedActions={currentCompletedActions} isLastStep={isLastStep} step={step} />
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

type StepActionsProps = {
  currentCompletedActions: RequiredAction[];
  isLastStep: boolean;
  step: Step;
};

const StepActions = ({ currentCompletedActions, isLastStep, step }: StepActionsProps) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!step.requiredActions && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [step.requiredActions]);

  if (step.requiredActions) {
    const greaterThan1 = step.requiredActions.length > 1;
    const plural = greaterThan1 ? 's' : '';
    return (
      <Stack direction={`column`}>
        <div className={styles.required}>{`${step.requiredActions.length} Required action${plural}${
          isLastStep ? ' to finish' : ``
        }`}</div>
        <RequiredActionsProgess
          currentCompletedActions={currentCompletedActions}
          requiredActions={step.requiredActions}
        />
      </Stack>
    );
  }

  return (
    <div>
      <Button onClick={() => dispatch(nextStep())} ref={buttonRef}>
        {isLastStep ? 'Finish' : 'Next'}
      </Button>
    </div>
  );
};

type RequiredActionsProgressProps = {
  currentCompletedActions: RequiredAction[];
  requiredActions: RequiredAction[];
};

const iconMap: Record<string, IconName> = {
  click: 'check',
  input: `keyboard`,
  change: `arrow-down`,
};

const RequiredActionsProgess = ({ currentCompletedActions, requiredActions }: RequiredActionsProgressProps) => {
  return (
    <Stack>
      {requiredActions.map((action) => {
        const isCompleted = currentCompletedActions.includes(action);
        return <Icon key={action.target} name={iconMap[action.action]} color={isCompleted ? `green` : `initial`} />;
      })}
    </Stack>
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
