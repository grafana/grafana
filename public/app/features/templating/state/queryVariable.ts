import { createSlice } from '@reduxjs/toolkit';

import { QueryVariableModel, VariableHide, VariableOption, VariableRefresh, VariableSort } from '../variable';
import { addVariable } from './actions';

export interface QueryVariableState extends QueryVariableModel {}

export const initialQueryVariableState: QueryVariableState = {
  global: false,
  index: -1,
  type: 'query',
  name: '',
  label: null,
  hide: VariableHide.dontHide,
  skipUrlSync: false,
  datasource: null,
  query: '',
  regex: '',
  sort: VariableSort.disabled,
  refresh: VariableRefresh.never,
  multi: false,
  includeAll: false,
  allValue: null,
  options: [],
  current: {} as VariableOption,
  tags: [],
  useTags: false,
  tagsQuery: '',
  tagValuesQuery: '',
  definition: '',
};

const queryVariableSlice = createSlice({
  name: 'queryVariable',
  initialState: initialQueryVariableState,
  reducers: {},
  extraReducers: builder =>
    builder
      // .addCase(newVariable, (state: QueryVariableState, action) => {
      //   return initialQueryVariableState;
      // })
      .addCase(addVariable, (state: QueryVariableState, action) => {
        const {
          type,
          name,
          label,
          hide,
          skipUrlSync,
          datasource,
          query,
          regex,
          sort,
          refresh,
          multi,
          includeAll,
          allValue,
          options,
          current,
          tags,
          useTags,
          tagsQuery,
          tagValuesQuery,
          definition,
        } = action.payload.model as QueryVariableModel;
        return {
          ...state,
          global: action.payload.global,
          index: action.payload.index,
          type,
          name,
          label,
          hide,
          skipUrlSync,
          datasource,
          query,
          regex,
          sort,
          refresh,
          multi,
          includeAll,
          allValue,
          options,
          current,
          tags,
          useTags,
          tagsQuery,
          tagValuesQuery,
          definition,
        };
      }),
  // .addCase(updateVariable, (state: QueryVariableState, action) => {
  //   return { ...state, ...action.payload };
  // }),
});

export const queryVariableReducer = queryVariableSlice.reducer;

export interface QueryVariablesState {
  variables: QueryVariableState[];
}

export const initialQueryVariablesState: QueryVariablesState = {
  variables: [],
};

const queryVariablesSlice = createSlice({
  name: 'queryVariables',
  initialState: initialQueryVariablesState,
  reducers: {},
  extraReducers: builder =>
    builder
      // .addCase(newVariable, (state: QueryVariablesState, action) => {
      //   if (action.payload !== 'query') {
      //     return;
      //   }
      //
      //   const variable = queryVariableReducer(undefined, action);
      //   const index = state.variables.push(variable) - 1;
      //   state.variables[index] = queryVariableReducer(state.variables[index], { ...variable, id: index });
      // })
      .addCase(addVariable, (state: QueryVariablesState, action) => {
        if (action.payload.model.type !== 'query') {
          return;
        }

        const variable = queryVariableReducer(undefined, action);
        const index = state.variables.push(variable) - 1;
        state.variables[index] = variable;
      }),
  // .addCase(updateVariable, (state: QueryVariablesState, action) => {
  //   if (action.payload.type !== 'query') {
  //     return;
  //   }
  //
  //   const index = state.variables.findIndex(variable => variable.id === action.payload.id);
  //   state.variables[index] = queryVariableReducer(state.variables[index], action);
  // }),
});

export const queryVariablesReducer = queryVariablesSlice.reducer;
// export const queryVariablesReducer = (
//   state: QueryVariablesState = initialQueryVariablesState,
//   action: AnyAction
// ): QueryVariablesState => {
//   if (createVariable.match(action)) {
//     if (action.payload !== 'query') {
//       return state;
//     }
//
//     const variable = queryVariableReducer(undefined, action);
//     return {
//       ...state,
//       variables: [...state.variables, { ...variable, id: state.variables.length }],
//     };
//   }
//   if (addVariable.match(action)) {
//     if (action.payload.type !== 'query') {
//       return state;
//     }
//
//     const variable = queryVariableReducer(undefined, action);
//     return {
//       ...state,
//       variables: [...state.variables, { ...variable, id: state.variables.length }],
//     };
//   }
//   if (updateVariable.match(action)) {
//     if (action.payload.type !== 'query') {
//       return state;
//     }
//
//     return {
//       ...state,
//       variables: state.variables.map(variable => {
//         if (variable.id !== action.payload.id) {
//           return variable;
//         }
//
//         return {
//           ...variable,
//           ...action.payload,
//         };
//       }),
//     };
//   }
//   return state;
// };
