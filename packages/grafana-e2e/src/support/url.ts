export interface UrlApi {
  fromBaseUrl: (url: string) => string;
}

export const Url: UrlApi = {
  fromBaseUrl: (url: string) => {
    url = url || '';
    const strippedUrl = url.replace('^/', '');
    const baseUrl = Cypress.config().baseUrl || 'http://localhost:3000';
    return `${baseUrl}${strippedUrl}`;
  },
};
