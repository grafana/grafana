import { e2e } from '../..';

export const clickGroupLayoutButton = (buttonLabel: string) => {
  cy.get(`[aria-label='layout-selection-option-${buttonLabel}']`).click();
};

export const selectTabsLayout = () => {
  clickGroupLayoutButton('Tabs');
};

export const selectRowsLayout = () => {
  clickGroupLayoutButton('Rows');
};

export const selectCustomGridLayout = () => {
  clickGroupLayoutButton('Custom');
};

export const selectAutoGridLayout = () => {
  clickGroupLayoutButton('Auto grid');
};

const editPaneCopyOrDuplicate = (buttonLabel: string) => {
  e2e.components.EditPaneHeader.copyDropdown().click();
  cy.get('[role="menu"]').within(() => {
    cy.contains(buttonLabel).click();
  });
};

export const editPaneCopy = () => editPaneCopyOrDuplicate('Copy');
export const editPaneDuplicate = () => editPaneCopyOrDuplicate('Duplicate');
