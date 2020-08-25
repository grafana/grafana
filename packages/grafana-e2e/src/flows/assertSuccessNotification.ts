import { e2e } from '../index';

export const assertSuccessNotification = () => {
  e2e()
    .get('[aria-label^="Alert success"]')
    .should('exist');
};
