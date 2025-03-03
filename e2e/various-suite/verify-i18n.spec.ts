import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

describe('Verify i18n', () => {
  const I18N_USER = 'i18n-test';
  const I18N_PASSWORD = 'i18n-test';

  // create a new user to isolate the language changes from other tests
  before(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.request({
      method: 'POST',
      url: fromBaseUrl('/api/admin/users'),
      body: {
        email: I18N_USER,
        login: I18N_USER,
        name: I18N_USER,
        password: I18N_PASSWORD,
      },
    }).then((response) => {
      cy.wrap(response.body.uid).as('uid');
    });
  });

  // remove the user created in the before hook
  after(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    cy.get('@uid').then((uid) => {
      cy.request({
        method: 'DELETE',
        url: fromBaseUrl(`/api/admin/users/${uid}`),
      });
    });
  });

  beforeEach(() => {
    e2e.flows.login(I18N_USER, I18N_PASSWORD);
  });

  // map between languages in the language picker and the corresponding translation of the 'Language' label
  const languageMap: Record<string, string> = {
    Deutsch: 'Sprache',
    English: 'Language',
    Español: 'Idioma',
    Français: 'Langue',
    'Português Brasileiro': 'Idioma',
    '中文（简体）': '语言',
  };

  // basic test which loops through the defined languages in the picker
  // and verifies that the corresponding label is translated correctly
  it('loads all the languages correctly', () => {
    cy.visit('/profile');
    const LANGUAGE_SELECTOR = '[id="locale-select"]';

    cy.wrap(Object.entries(languageMap)).each(([language, label]: [string, string]) => {
      cy.get(LANGUAGE_SELECTOR).should('not.be.disabled');
      cy.get(LANGUAGE_SELECTOR).click();
      cy.get(LANGUAGE_SELECTOR).clear().type(language).type('{downArrow}{enter}');
      e2e.components.UserProfile.preferencesSaveButton().click();
      cy.contains('label', label).should('be.visible');
      cy.get(LANGUAGE_SELECTOR).should('have.value', language);
    });
  });
});
