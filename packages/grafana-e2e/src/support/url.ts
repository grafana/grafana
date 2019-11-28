export interface UrlApi {
  fromBaseUrl: (url: string | undefined) => string;
}

export const Url: UrlApi = {
  fromBaseUrl: (url: string | undefined) => {
    url = url || '';
    const strippedUrl = url.replace('^/', '');
    const baseUrl = Cypress.env('BASE_URL') || Cypress.config().baseUrl || 'http://localhost:3000';
    return `${baseUrl}${strippedUrl}`;
  },
};
