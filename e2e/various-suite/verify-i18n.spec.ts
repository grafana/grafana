import { e2e } from '../utils';

describe('Verify i18n', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
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

  if (process.env.NODE_ENV === 'development') {
    languageMap['Pseudo-locale'] = 'Ŀäŉģūäģę';
  }

  // basic test which loops through the defined languages in the picker
  // and verifies that the corresponding label is translated correctly
  it('loads all the languages correctly', () => {
    cy.intercept('/api/user/preferences').as('preferences');
    cy.visit('/profile');

    cy.wrap(Object.entries(languageMap)).each(([language, label]: [string, string]) => {
      // TODO investigate why we need to wait for 5 (FIVE!) calls to the preferences API
      cy.wait(['@preferences', '@preferences', '@preferences', '@preferences', '@preferences']);
      cy.get('[id="locale-select"]').click();
      cy.get('[id="locale-select"]').clear().type(language).type('{downArrow}{enter}');
      e2e.components.UserProfile.preferencesSaveButton().click();
      cy.wait('@preferences');
      cy.contains('label', label).should('be.visible');
    });
  });
});
