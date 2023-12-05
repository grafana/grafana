import { createSlice } from '@reduxjs/toolkit';

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

const tutorialsSlice = createSlice({
  name: 'tutorials',
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
    resetCurrentTutorial(state) {
      state.currentTutorial = null;
      state.currentStep = null;
    },
  },
});

export const { removeTutorial, addTutorial, setCurrentTutorial, setCurrentStep, resetCurrentTutorial } =
  tutorialsSlice.actions;

export const tutorialsReducer = tutorialsSlice.reducer;

export default {
  tutorials: tutorialsReducer,
};
