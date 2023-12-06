import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Button, Text } from '@grafana/ui';
import { StoreState, useDispatch } from 'app/types';

import { nextStep } from './slice';
import { type Step } from './types';

const TutorialTooltipComponent = ({
  availableTutorials,
  currentTutorialId,
  currentStepIndex,
}: ConnectedProps<typeof connector>) => {
  const dispatch = useDispatch();
  const currentTutorial = availableTutorials.find((t) => t.id === currentTutorialId);
  const step = currentStepIndex !== null && currentTutorial ? currentTutorial.steps[currentStepIndex] : null;

  if (step) {
    return (
      <>
        {renderStepTitle(step.title)}
        {renderContent(step.content)}
        {!step.requiredActions && (
          <div>
            <Button onClick={() => dispatch(nextStep())}>Next</Button>
          </div>
        )}
      </>
    );
  }

  return null;
};

function renderStepTitle(title: Step['title']) {
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
}

function renderContent(content: Step['content']) {
  if (!content) {
    return null;
  }

  if (typeof content === 'string') {
    return <div>{content}</div>;
  }

  return <div>{content}</div>;
}

TutorialTooltipComponent.displayName = 'TutorialTooltip';

const mapStateToProps = (state: StoreState) => {
  return {
    ...state.tutorials,
  };
};

const connector = connect(mapStateToProps);

export const TutorialTooltip = connector(TutorialTooltipComponent);
