import { VariableModel, QueryVariableModel } from './variable';

export const isQuery = (model: VariableModel): model is QueryVariableModel => {
  return model.type === 'query';
};
