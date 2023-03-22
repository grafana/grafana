import { e2e } from '../index';

export enum PanelMenuItems {
  Edit = 'Edit',
  Inspect = 'Inspect',
  More = 'More...',
  Extensions = 'Extensions',
}

export const openPanelMenuItem = (menu: PanelMenuItems, panelTitle = 'Panel Title') => {
  e2e.components.Panels.Panel.title(panelTitle).should('be.visible').click();

  e2e.components.Panels.Panel.headerItems(menu).should('be.visible').click();
};

export const openPanelMenuExtension = (extensionTitle: string, panelTitle = 'Panel Title') => {
  e2e.components.Panels.Panel.title(panelTitle).should('be.visible').click();

  e2e.components.Panels.Panel.headerItems(PanelMenuItems.Extensions)
    .should('be.visible')
    .parent()
    .parent()
    .invoke('addClass', 'open');

  e2e.components.Panels.Panel.headerItems(extensionTitle).should('be.visible').click();
};
