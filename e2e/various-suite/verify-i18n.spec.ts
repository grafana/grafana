import { e2e } from '../utils';

describe('Verify i18n', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  const languageMap = {
    Deutsch: 'Sprache',
    English: 'Language',
    Español: 'Idioma',
    Français: 'Langue',
    'Português Brasileiro': 'Idioma',
    '中文（简体）': '语言',
    'Pseudo-locale': 'Ŀäŉģūäģę',
  };

  it('loads all the languages correctly', () => {
    cy.intercept('GET', '/api/user/preferences').as('preferences');
    cy.visit('/profile');

    cy.wrap(Object.entries(languageMap)).each(([language, label]: [string, string]) => {
      // TODO investigate why we need to wait for 6 (SIX!) calls to the preferences API
      cy.wait('@preferences');
      cy.wait('@preferences');
      cy.wait('@preferences');
      cy.wait('@preferences');
      cy.wait('@preferences');
      cy.wait('@preferences');
      cy.get('[id="locale-select"]').click();
      cy.get('[id="locale-select"]').type(language).type('{downArrow}{enter}');
      e2e.components.UserProfile.preferencesSaveButton().click();
      cy.contains('label', label).should('be.visible');
    });
  });
});
