import { createSlice } from '@reduxjs/toolkit';

import {
  QueryVariableModel,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableSort,
  VariableTag,
} from '../variable';
import { addVariable, updateVariableOptions, updateVariableTags } from './actions';
import _ from 'lodash';
import { stringToJsRegex } from '@grafana/data';
import templateSrv from '../template_srv';

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

const sortVariableValues = (options: any[], sortOrder: VariableSort) => {
  if (sortOrder === VariableSort.disabled) {
    return options;
  }

  const sortType = Math.ceil(sortOrder / 2);
  const reverseSort = sortOrder % 2 === 0;

  if (sortType === 1) {
    options = _.sortBy(options, 'text');
  } else if (sortType === 2) {
    options = _.sortBy(options, opt => {
      const matches = opt.text.match(/.*?(\d+).*/);
      if (!matches || matches.length < 2) {
        return -1;
      } else {
        return parseInt(matches[1], 10);
      }
    });
  } else if (sortType === 3) {
    options = _.sortBy(options, opt => {
      return _.toLower(opt.text);
    });
  }

  if (reverseSort) {
    options = options.reverse();
  }

  return options;
};
const metricNamesToVariableValues = (variableRegEx: string, sort: VariableSort, metricNames: any[]) => {
  let regex, options, i, matches;
  options = [];

  if (variableRegEx) {
    regex = stringToJsRegex(templateSrv.replace(variableRegEx, {}, 'regex'));
  }
  for (i = 0; i < metricNames.length; i++) {
    const item = metricNames[i];
    let text = item.text === undefined || item.text === null ? item.value : item.text;

    let value = item.value === undefined || item.value === null ? item.text : item.value;

    if (_.isNumber(value)) {
      value = value.toString();
    }

    if (_.isNumber(text)) {
      text = text.toString();
    }

    if (regex) {
      matches = regex.exec(value);
      if (!matches) {
        continue;
      }
      if (matches.length > 1) {
        value = matches[1];
        text = matches[1];
      }
    }

    options.push({ text: text, value: value });
  }

  options = _.uniqBy(options, 'value');
  return sortVariableValues(options, sort);
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
      })
      .addCase(updateVariableOptions, (state: QueryVariableState, action) => {
        const results = action.payload.results;
        const { regex, includeAll, sort } = state;
        const options = metricNamesToVariableValues(regex, sort, results);
        if (includeAll) {
          options.unshift({ text: 'All', value: '$__all', selected: false });
        }
        if (!options.length) {
          options.push({ text: 'None', value: '', isNone: true, selected: false });
        }

        state.options = options;
      })
      .addCase(updateVariableTags, (state: QueryVariableState, action) => {
        const results = action.payload.results;
        const tags: VariableTag[] = [];
        for (let i = 0; i < results.length; i++) {
          tags.push({ text: results[i].text, selected: false });
        }

        state.tags = tags;
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
      })
      .addCase(updateVariableOptions, (state: QueryVariablesState, action) => {
        if (action.payload.variable.type !== 'query') {
          return;
        }

        const index = state.variables.findIndex(variable => variable.name === action.payload.variable.name);
        state.variables[index] = queryVariableReducer(state.variables[index], action);
      })
      .addCase(updateVariableTags, (state: QueryVariablesState, action) => {
        if (action.payload.variable.type !== 'query') {
          return;
        }

        const index = state.variables.findIndex(variable => variable.name === action.payload.variable.name);
        state.variables[index] = queryVariableReducer(state.variables[index], action);
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
