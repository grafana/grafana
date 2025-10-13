import { e2e } from '..';

export function confirmDelete() {
  cy.get(`input[placeholder='Type "Delete" to confirm']`).type('Delete');
  e2e.pages.ConfirmModal.delete().click();
}
