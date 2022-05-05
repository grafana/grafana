import { flow, camelCase, upperFirst } from 'lodash';

export const pascalCase = flow([camelCase, upperFirst]);
