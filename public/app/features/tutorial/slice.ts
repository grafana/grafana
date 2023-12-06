import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { RootState } from 'app/store/configureStore';

import { checkCorrectValue, waitForElement } from './tutorialProvider.utils';
import type { SkipCondition, Tutorial } from './types';

type TutorialsState = {
  availableTutorials: Tutorial[];
  currentTutorial: Tutorial['id'] | null;
  currentStep: number | null;
};

const initialState: TutorialsState = {
  availableTutorials: [],
  currentTutorial: null,
  currentStep: null,
};

const STATE_PREFIX = 'tutorials';

const tutorialsSlice = createSlice({
  name: STATE_PREFIX,
  initialState,
  reducers: {
    removeTutorial(state, action) {
      state.availableTutorials = state.availableTutorials.filter((tutorial) => tutorial.id !== action.payload);
    },
    addTutorial(state, action) {
      state.availableTutorials.push(action.payload);
    },
    setCurrentTutorial(state, action) {
      state.currentTutorial = action.payload;
    },
    setCurrentStep(state, action) {
      state.currentStep = action.payload;
    },
    nextStep(state, action) {
      state.currentStep = action.payload;
    },
    resetCurrentTutorial(state) {
      state.currentTutorial = null;
      state.currentStep = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(nextStep.fulfilled, (state, action) => {
      const currentTutorial = getTutorial(state.availableTutorials, state.currentTutorial);

      if (action.payload < currentTutorial.steps.length) {
        state.currentStep = action.payload;
      }

      if (action.payload >= currentTutorial.steps.length) {
        state.currentTutorial = null;
        state.currentStep = null;
      }
    });
  },
});

export const nextStep = createAsyncThunk<number, void, { state: RootState }>(
  `${STATE_PREFIX}/nextStep`,
  async (_, thunkApi) => {
    const { availableTutorials, currentStep, currentTutorial } = thunkApi.getState().tutorials;
    const tutorial = getTutorial(availableTutorials, currentTutorial);
    const nextStepIndex = currentStep === null ? 0 : currentStep + 1;
    const realNextStepIndex = await checkSkipConditions(tutorial, nextStepIndex, 'forwards');

    return realNextStepIndex;
  }
);

export function getTutorial(availableTutorials: Tutorial[], tutorialId: Tutorial['id'] | null): Tutorial {
  return availableTutorials.find((tutorial) => tutorial.id === tutorialId)!;
}

export function getStep(tutorial: Tutorial | undefined, step: number) {
  return tutorial?.steps[step];
}

async function checkSkipConditions(tutorial: Tutorial, stepIndex: number, direction: 'forwards' | 'backwards') {
  const steps = direction === 'forwards' ? tutorial.steps : [...tutorial.steps].reverse();
  const step = steps[stepIndex];
  const skipConditions = step?.skip;

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
        const { width, height } = element.getBoundingClientRect();
        return width > 0 && height > 0;
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

export const { addTutorial, removeTutorial, resetCurrentTutorial, setCurrentStep, setCurrentTutorial } =
  tutorialsSlice.actions;

export const tutorialsReducer = tutorialsSlice.reducer;

export default {
  tutorials: tutorialsReducer,
};
