import { createSlice } from '@reduxjs/toolkit';
import { initialVariableModelState } from 'app/features/variables/types';
import { getInstanceState } from '../state/selectors';
import { initialVariablesState } from '../state/types';
export const initialAdHocVariableModelState = Object.assign(Object.assign({}, initialVariableModelState), { type: 'adhoc', datasource: null, filters: [] });
export const adHocVariableSlice = createSlice({
    name: 'templating/adhoc',
    initialState: initialVariablesState,
    reducers: {
        filterAdded: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'adhoc') {
                return;
            }
            instanceState.filters.push(action.payload.data);
        },
        filterRemoved: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'adhoc') {
                return;
            }
            const index = action.payload.data;
            instanceState.filters.splice(index, 1);
        },
        filterUpdated: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'adhoc') {
                return;
            }
            const { filter, index } = action.payload.data;
            instanceState.filters[index] = filter;
        },
        filtersRestored: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'adhoc') {
                return;
            }
            instanceState.filters = action.payload.data;
        },
    },
});
export const { filterAdded, filterRemoved, filterUpdated, filtersRestored } = adHocVariableSlice.actions;
export const adHocVariableReducer = adHocVariableSlice.reducer;
//# sourceMappingURL=reducer.js.map