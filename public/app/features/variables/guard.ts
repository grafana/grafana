import {
  QueryVariableModel,
  VariableModel,
  AdHocVariableModel,
  CustomVariableModel,
  VariableWithMultiSupport,
} from '../templating/types';

export const isQuery = (model: VariableModel): model is QueryVariableModel => {
  return model.type === 'query';
};

export const isAdHoc = (model: VariableModel): model is AdHocVariableModel => {
  return model.type === 'adhoc';
};

export const isCustom = (model: VariableModel): model is CustomVariableModel => {
  return model.type === 'custom';
};

export const isMulti = (model: VariableModel): model is VariableWithMultiSupport => {
  const withMulti = model as VariableWithMultiSupport;
  return withMulti.hasOwnProperty('multi') && typeof withMulti.multi === 'boolean';
};
