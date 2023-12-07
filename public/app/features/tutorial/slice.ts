import { Dispatch, createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { RootState } from 'app/store/configureStore';

import { checkSkipConditions, getFurthestStep, getTutorial } from './slice.utils';
import type { Tutorial } from './types';

type TutorialsState = {
  availableTutorials: Tutorial[];
  currentTutorialId: Tutorial['id'] | null;
  currentStepIndex: number | null;
  stepTransition: StepTransition;
};

type StepTransition = 'transitioning' | 'none';

const initialState: TutorialsState = {
  availableTutorials: [],
  currentTutorialId: null,
  currentStepIndex: null,
  stepTransition: `none`,
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
    addTutorials(state, action) {
      state.availableTutorials = [...state.availableTutorials, ...action.payload];
    },
    setCurrentTutorialId(state, action) {
      state.currentTutorialId = action.payload;
    },
    exitCurrentTutorial(state) {
      state.currentTutorialId = null;
      state.currentStepIndex = null;
    },
    resetTutorials(state) {
      state.availableTutorials = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(nextStep.pending, (state) => {
      state.stepTransition = `transitioning`;
    });

    builder.addCase(nextStep.fulfilled, (state, action) => {
      const currentTutorial = getTutorial(state.availableTutorials, state.currentTutorialId);

      state.availableTutorials = state.availableTutorials.map((tutorial) => {
        if (tutorial.id === state.currentTutorialId) {
          return {
            ...tutorial,
            furthestStepCompleted: getFurthestStep(action.payload, tutorial.furthestStepCompleted),
          };
        }

        return tutorial;
      });

      if (action.payload < currentTutorial.steps.length) {
        state.currentStepIndex = action.payload;
      }

      if (action.payload >= currentTutorial.steps.length) {
        state.currentTutorialId = null;
        state.currentStepIndex = null;
      }

      state.stepTransition = `none`;
    });
  },
});

export const nextStep = createAsyncThunk<number, void, { state: RootState }>(
  `${STATE_PREFIX}/nextStep`,
  async (_, thunkApi) => {
    const { availableTutorials, currentStepIndex, currentTutorialId } = thunkApi.getState().tutorials;
    const tutorial = getTutorial(availableTutorials, currentTutorialId);
    const nextStepIndex = currentStepIndex === null ? 0 : currentStepIndex + 1;
    const realNextStepIndex = await checkSkipConditions(tutorial, nextStepIndex, 'forwards');

    return realNextStepIndex;
  }
);

const { setCurrentTutorialId } = tutorialsSlice.actions;
export const { addTutorial, addTutorials, removeTutorial, exitCurrentTutorial, resetTutorials } =
  tutorialsSlice.actions;

export const startTutorial = (tutorialId: Tutorial['id']) => (dispatch: Dispatch, getState: () => RootState) => {
  dispatch(setCurrentTutorialId(tutorialId));
  // @ts-expect-error
  dispatch(nextStep());
};

export const tutorialsReducer = tutorialsSlice.reducer;

export default {
  tutorials: tutorialsReducer,
};
