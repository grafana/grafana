import { e2e } from '../index';

const getBaseUrl = () => Cypress.env('BASE_URL') || Cypress.config().baseUrl || 'http://localhost:3000';

export const fromBaseUrl = (url = '') => new URL(url, getBaseUrl()).href;

export const getDashboardUid = (url: string): string => {
  const matches = new URL(url).pathname.match(/\/d\/([^/]+)/);
  if (!matches) {
    throw new Error(`Couldn't parse uid from ${url}`);
  } else {
    return matches[1];
  }
};
