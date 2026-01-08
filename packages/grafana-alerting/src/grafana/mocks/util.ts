import { faker } from '@faker-js/faker';
import { upperFirst } from 'lodash';

export const DEFAULT_NAMESPACE = 'default' as const;

// this function is used for MSW endpoints
export const getAPIBaseURLForMocks = (group: string, version: string, path: `/${string}` = '/') =>
  `/apis/${group}/${version}/namespaces/default${path}` as const;

// example: "Likeable sea lion"
export const generateTitle = () => upperFirst(`${faker.word.adjective()} ${faker.animal.type()}`);

export const generateResourceVersion = () => faker.string.alphanumeric({ length: 16, casing: 'lower' });

export const generateUID = () => faker.string.alphanumeric({ length: 32, casing: 'mixed' });
