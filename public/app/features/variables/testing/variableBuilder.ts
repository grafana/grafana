import { AdHocVariableBuilder } from './adHocVariableBuilder';
import { AdHocVariableModel } from 'app/features/templating/variable';

export const adHocVariable = (partial: Partial<AdHocVariableModel> = {}) => new AdHocVariableBuilder(partial);
