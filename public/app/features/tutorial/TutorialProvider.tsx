import React, { useState, useEffect, useCallback } from 'react';

import { ConfirmModal } from '@grafana/ui';

import { TutorialOverlay } from './TutorialOverlay';
import { tutorialSteps } from './hardCodedSteps';
import {
  waitForElement,
  type ChangeAction,
  type ClickAction,
  type RequiredAction,
  type Step,
} from './tutorialProvider.utils';

export const TutorialProvider = () => {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showExitTutorialModal, setShowExitTutorialModal] = useState(false);
  const step = stepIndex && tutorialSteps[stepIndex];

  const advance = useCallback(() => {
    setShowTooltip(false);

    if (stepIndex) {
      setStepIndex(stepIndex + 1);
    }
  }, [stepIndex]);

  const onReady = useCallback(() => {
    setShowTooltip(true);
  }, []);

  useEffect(() => {
    if (step) {
      setupTutorialStep(step, onReady, advance);
    }
  }, [advance, onReady, step]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowExitTutorialModal(true);
      }
    };

    // TODO: why doesn't this work on keydown?
    window.addEventListener('keyup', handler);

    return () => {
      window.removeEventListener('keyup', handler);
    };
  }, []);

  if (step) {
    return (
      <>
        <TutorialOverlay showTooltip={showTooltip} step={step} advance={step.requiredActions ? null : advance} />
        <ConfirmModal
          confirmText="Stop tutorial"
          onDismiss={() => {}}
          isOpen={showExitTutorialModal}
          title={`Exit tutorial?`}
          body={`Do you want to stop the tutorial?`}
          onConfirm={() => setStepIndex(null)}
        />
      </>
    );
  }

  return null;
};

function setupTutorialStep(step: Step, onReady: () => void, onComplete: () => void) {
  waitForElement(step.target).then((element) => {
    requestAnimationFrame(() => {
      onReady();
    });

    if (step.requiredActions) {
      resolveRequiredActions(step.requiredActions).then(() => {
        onComplete();
      });
    }
  });
}

async function resolveRequiredActions(requiredActions: RequiredAction[]) {
  for (const action of requiredActions) {
    await setUpRequiredAction(action);
  }

  return true;
}

function setUpRequiredAction(action: RequiredAction) {
  return new Promise((resolve) => {
    const { target } = action;
    waitForElement(target).then((targetElement) => {
      if (isClickAction(action)) {
        setupClickAction(targetElement, resolve);
      }

      if (isChangeAction(action)) {
        setupChangeAction(targetElement, action, resolve);
      }
    });
  });
}

function setupClickAction(targetElement: Element, onComplete: (value: unknown) => void) {
  targetElement.addEventListener('click', onComplete, { once: true });
}

function setupChangeAction(targetElement: Element, action: ChangeAction, onComplete: (value: unknown) => void) {
  if (targetElement.getAttribute(action.attribute.name) === action.attribute.value) {
    onComplete(action.attribute.value);
    return;
  }

  const observer = new MutationObserver((mutationsList, observer) => {
    for (let mutation of mutationsList) {
      const newValue = targetElement.getAttribute(action.attribute.name);
      const isCorrectAttribute = mutation.attributeName === action.attribute.name;
      const isCorrectValue = newValue === action.attribute.value;

      if (mutation.type === 'attributes' && isCorrectAttribute && isCorrectValue) {
        onComplete(newValue);
        observer.disconnect();
        return;
      }
    }
  });

  observer.observe(targetElement, { attributes: true, attributeFilter: [action.attribute.name] });
}

function isClickAction(action: RequiredAction): action is ClickAction {
  return action.action === 'click';
}

function isChangeAction(action: RequiredAction): action is ChangeAction {
  return action.action === 'change';
}
