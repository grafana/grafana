import { QueryVariableModel, VariableModel, AdHocVariableModel } from '../templating/variable';

export const isQuery = (model: VariableModel): model is QueryVariableModel => {
  return model.type === 'query';
};

export const isAdHoc = (model: VariableModel): model is AdHocVariableModel => {
  return model.type === 'adhoc';
};
