import { e2e } from '../..';

export const configurePanel = () => {
  e2e.components.Panels.Panel.content().contains('Configure').should('be.visible').click();
};
