import { createSlice } from '@reduxjs/toolkit';
import { map } from 'lodash';
import { getInstanceState } from '../state/selectors';
import { initialVariablesState } from '../state/types';
import { initialVariableModelState, VariableRefresh } from '../types';
export const initialIntervalVariableModelState = Object.assign(Object.assign({}, initialVariableModelState), { type: 'interval', auto_count: 30, auto_min: '10s', options: [], auto: false, query: '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d', refresh: VariableRefresh.onTimeRangeChanged, current: {} });
export const intervalVariableSlice = createSlice({
    name: 'templating/interval',
    initialState: initialVariablesState,
    reducers: {
        createIntervalOptions: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'interval') {
                return;
            }
            const options = map(instanceState.query.match(/(["'])(.*?)\1|\w+/g), (text) => {
                text = text.replace(/["']+/g, '');
                return { text: text.trim(), value: text.trim(), selected: false };
            });
            if (instanceState.auto) {
                // add auto option if missing
                if (options.length && options[0].text !== 'auto') {
                    options.unshift({
                        text: 'auto',
                        value: '$__auto_interval_' + instanceState.name,
                        selected: false,
                    });
                }
            }
            instanceState.options = options;
        },
    },
});
export const intervalVariableReducer = intervalVariableSlice.reducer;
export const { createIntervalOptions } = intervalVariableSlice.actions;
//# sourceMappingURL=reducer.js.map