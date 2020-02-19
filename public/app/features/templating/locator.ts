import { QueryVariableAdapter } from './adapters/queryVariableAdapter';
import { VariableModel, VariableType, VariableActions, QueryVariableModel } from './variable';
import { PureComponent } from '@grafana/data/node_modules/@types/react';
import { QueryVariableEditor } from './editor/QueryVariableEditor';
import { QueryVariablePicker } from './picker/QueryVariablePicker';
import { queryVariableReducer, initialQueryVariableState } from './state/queryVariableReducer';
import { Reducer } from '@reduxjs/toolkit';

export const getFactory = (type: VariableType): ((model: QueryVariableModel) => VariableModel & VariableActions) => {
  switch (type) {
    case 'query':
      return (model: QueryVariableModel) => new QueryVariableAdapter(model);
    default:
      return null;
  }
};

export const getEditor = (type: VariableType): typeof PureComponent | null => {
  switch (type) {
    case 'query':
      return QueryVariableEditor;
    default:
      return null;
  }
};

export const getPicker = (type: VariableType): typeof PureComponent | null => {
  switch (type) {
    case 'query':
      return QueryVariablePicker;
    default:
      return null;
  }
};

export const getReducer = (type: VariableType): Reducer | null => {
  switch (type) {
    case 'query':
      return queryVariableReducer;
    default:
      return null;
  }
};

export const getInitialState = (type: VariableType) => {
  switch (type) {
    case 'query':
      return initialQueryVariableState;
    default:
      return null;
  }
};
