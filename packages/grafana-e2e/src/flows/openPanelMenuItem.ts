import { e2e } from '../index';

export enum PanelMenuItems {
  Edit = 'Edit',
  Inspect = 'Inspect',
  More = 'More...',
  Extensions = 'Extensions',
}

export const openPanelMenuItem = (menu: PanelMenuItems, panelTitle = 'Panel Title') => {
  // we changed the way we open the panel menu in react panels with the new panel header
  detectPanelType(panelTitle, (isAngularPanel) => {
    if (isAngularPanel) {
      e2e.components.Panels.Panel.title(panelTitle).should('be.visible').click();
      e2e.components.Panels.Panel.headerItems(menu).should('be.visible').click();
    } else {
      e2e.components.Panels.Panel.menu(panelTitle).click({ force: true }); // force click because menu is hidden and show on hover
      e2e.components.Panels.Panel.menuItems(menu).should('be.visible').click();
    }
  });
};

export const openPanelMenuExtension = (extensionTitle: string, panelTitle = 'Panel Title') => {
  const menuItem = PanelMenuItems.Extensions;
  // we changed the way we open the panel menu in react panels with the new panel header
  detectPanelType(panelTitle, (isAngularPanel) => {
    if (isAngularPanel) {
      e2e.components.Panels.Panel.title(panelTitle).should('be.visible').click();
      e2e.components.Panels.Panel.headerItems(menuItem)
        .should('be.visible')
        .parent()
        .parent()
        .invoke('addClass', 'open');
      e2e.components.Panels.Panel.headerItems(extensionTitle).should('be.visible').click();
    } else {
      e2e.components.Panels.Panel.menu(panelTitle).click({ force: true }); // force click because menu is hidden and show on hover
      e2e.components.Panels.Panel.menuItems(menuItem).trigger('mouseover', { force: true });
      e2e.components.Panels.Panel.menuItems(extensionTitle).click({ force: true });
    }
  });
};

function detectPanelType(panelTitle: string, detected: (isAngularPanel: boolean) => void) {
  e2e.components.Panels.Panel.title(panelTitle).then((el) => {
    const isAngularPanel = el.find('plugin-component.ng-scope').length > 0;

    if (isAngularPanel) {
      Cypress.log({
        name: 'detectPanelType',
        displayName: 'detector',
        message: 'Angular panel detected, will use legacy selectors.',
      });
    }

    detected(isAngularPanel);
  });
}
