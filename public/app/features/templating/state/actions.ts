import { createAction } from '@reduxjs/toolkit';
import { VariableModel, VariableType } from '../variable';

export interface AddVariable<T extends VariableModel = VariableModel> {
  global: boolean; // part of dashboard or global
  index: number; // the order in variables list
  model: T;
}

export const newVariable = createAction<VariableType>('templating/newVariable');
export const addVariable = createAction<AddVariable>('templating/addVariable');
export const updateVariable = createAction<VariableModel>('templating/updateVariable');
