import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { RootState } from 'app/store/configureStore';

import { checkSkipConditions, getFurthestStep, getTutorial } from './slice.utils';
import type { Tutorial } from './types';

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
    addTutorials(state, action) {
      state.availableTutorials = [...state.availableTutorials, ...action.payload];
    },
    setCurrentTutorial(state, action) {
      state.currentTutorial = action.payload;
    },
    setCurrentStep(state, action) {
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

      state.availableTutorials = state.availableTutorials.map((tutorial) => {
        if (tutorial.id === state.currentTutorial) {
          return {
            ...tutorial,
            furthestStepCompleted: getFurthestStep(action.payload, tutorial.furthestStepCompleted),
          };
        }

        return tutorial;
      });

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

export const { addTutorial, addTutorials, removeTutorial, resetCurrentTutorial, setCurrentStep, setCurrentTutorial } =
  tutorialsSlice.actions;

export const tutorialsReducer = tutorialsSlice.reducer;

export default {
  tutorials: tutorialsReducer,
};
