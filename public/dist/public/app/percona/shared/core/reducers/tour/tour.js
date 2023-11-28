import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setAlertingTourCompleted, setProductTourCompleted } from '../user/user';
import { TourType } from './tour.types';
const initialState = {
    isOpen: false,
    steps: {
        [TourType.Alerting]: [],
        [TourType.Product]: [],
    },
};
const tourSlice = createSlice({
    name: 'tour',
    initialState,
    reducers: {
        setSteps: (state, { payload }) => (Object.assign(Object.assign({}, state), { steps: Object.assign(Object.assign({}, state.steps), { [payload.tour]: payload.steps }) })),
        startTour: (state, { payload }) => (Object.assign(Object.assign({}, state), { isOpen: true, tour: payload })),
        resetTour: (state) => (Object.assign(Object.assign({}, state), { isOpen: false, tour: undefined })),
    },
});
export const endTourAction = createAsyncThunk('percona/endTour', (tour, { dispatch }) => {
    if (tour === TourType.Product) {
        dispatch(setProductTourCompleted(true));
    }
    else if (tour === TourType.Alerting) {
        dispatch(setAlertingTourCompleted(true));
    }
    dispatch(tourSlice.actions.resetTour());
});
export const { setSteps, startTour } = tourSlice.actions;
export default tourSlice.reducer;
//# sourceMappingURL=tour.js.map