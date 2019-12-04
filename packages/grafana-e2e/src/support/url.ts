export interface UrlApi {
  fromBaseUrl: (url: string | undefined) => string;
  getDashboardUid: (url: string) => string;
}

const uidRegex = '\\/d\\/(.*)\\/';
const getBaseUrl = () => Cypress.env('BASE_URL') || Cypress.config().baseUrl || 'http://localhost:3000';

export const Url: UrlApi = {
  fromBaseUrl: (url: string | undefined) => {
    url = url || '';
    const strippedUrl = url.replace('^/', '');
    return `${getBaseUrl()}${strippedUrl}`;
  },
  getDashboardUid: (url: string) => {
    const matches = url.match(uidRegex);
    if (!matches) {
      throw new Error(`Couldn't parse uid from ${url}`);
    }

    return matches[1];
  },
};
