import _ from 'lodash';

export const pascalCase = _.flow(_.camelCase, _.upperFirst);
