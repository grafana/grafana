import { e2e } from '../index';

export const assertSuccessNotification = () => {
  e2e()
    .get('.alert-success')
    .should('exist');
};
