import { e2e } from '../..';

export const toggleEditMode = () => {
  e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();
};
