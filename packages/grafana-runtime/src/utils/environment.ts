import { lowerCase } from 'lodash';

const current = lowerCase(process.env.NODE_ENV);
const testEnvironment = 'test';

export function isTest(): boolean {
  return current === testEnvironment;
}
