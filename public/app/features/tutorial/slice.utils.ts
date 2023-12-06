import { checkCorrectValue, isElementVisible, waitForElement } from './tutorialProvider.utils';
import type { SkipCondition, Tutorial } from './types';

export async function checkSkipConditions(tutorial: Tutorial, stepIndex: number, direction: 'forwards' | 'backwards') {
  const steps = direction === 'forwards' ? tutorial.steps : [...tutorial.steps].reverse();
  const step = steps[stepIndex];
  const skipConditions = step?.skipConditions;

  if (!skipConditions) {
    return stepIndex;
  }

  const canSkipStep = await passedSkipConditions(skipConditions, stepIndex);
  if (canSkipStep) {
    return checkSkipConditions(tutorial, stepIndex + 1, direction);
  }

  return stepIndex;
}

async function passedSkipConditions(skipConditions: SkipCondition[], stepIndex: number) {
  let canSkipStep = false;

  if (skipConditions) {
    canSkipStep = true;

    for (const condition of skipConditions) {
      const shouldSkipCondition = await shouldSkip(condition, stepIndex);
      if (!shouldSkipCondition) {
        canSkipStep = false;
      }
    }
  }

  return canSkipStep;
}

async function shouldSkip(condition: SkipCondition, stepIndex: number) {
  const timeout = stepIndex === 0 ? 0 : undefined;

  return waitForElement(condition.target, timeout)
    .then((element) => {
      if (condition.condition === 'visible') {
        return isElementVisible(element);
      }

      if (condition.condition === 'match') {
        const targetValue = element.getAttribute(condition.attribute.name);

        if (!targetValue) {
          return false;
        }

        return checkCorrectValue(targetValue, condition.attribute);
      }

      return false;
    })
    .catch(() => false);
}

export function getTutorial(availableTutorials: Tutorial[], tutorialId: Tutorial['id'] | null): Tutorial {
  return availableTutorials.find((tutorial) => tutorial.id === tutorialId)!;
}

export function getFurthestStep(currentStep: number, currentFurthest?: number) {
  if (currentFurthest && currentFurthest >= currentStep) {
    return currentFurthest;
  }

  const isStep0 = currentStep === 0;

  if (isStep0) {
    return undefined;
  }

  return currentStep - 1;
}
