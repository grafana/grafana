import { QueryVariableModel, VariableModel } from '../templating/variable';

export const isQuery = (model: VariableModel): model is QueryVariableModel => {
  return model.type === 'query';
};
