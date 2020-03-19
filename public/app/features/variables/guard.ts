import { QueryVariableModel, VariableModel } from '../templating/types';

export const isQuery = (model: VariableModel): model is QueryVariableModel => {
  return model.type === 'query';
};
