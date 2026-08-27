import { type LazyMutationCommand } from './types';

export const LAZY_DASHBOARD_COMMANDS: LazyMutationCommand[] = [
  { name: 'ADD_VARIABLE', load: () => import('./addVariable').then((module) => module.addVariableCommand) },
  { name: 'REMOVE_VARIABLE', load: () => import('./removeVariable').then((module) => module.removeVariableCommand) },
  { name: 'UPDATE_VARIABLE', load: () => import('./updateVariable').then((module) => module.updateVariableCommand) },
  { name: 'LIST_VARIABLES', load: () => import('./listVariables').then((module) => module.listVariablesCommand) },
  { name: 'ADD_ANNOTATION', load: () => import('./addAnnotation').then((module) => module.addAnnotationCommand) },
  {
    name: 'UPDATE_ANNOTATION',
    load: () => import('./updateAnnotation').then((module) => module.updateAnnotationCommand),
  },
  {
    name: 'REMOVE_ANNOTATION',
    load: () => import('./removeAnnotation').then((module) => module.removeAnnotationCommand),
  },
  {
    name: 'LIST_ANNOTATIONS',
    load: () => import('./listAnnotations').then((module) => module.listAnnotationsCommand),
  },
  { name: 'ENTER_EDIT_MODE', load: () => import('./enterEditMode').then((module) => module.enterEditModeCommand) },
  { name: 'GET_LAYOUT', load: () => import('./getLayout').then((module) => module.getLayoutCommand) },
  { name: 'ADD_ROW', load: () => import('./addRow').then((module) => module.addRowCommand) },
  { name: 'REMOVE_ROW', load: () => import('./removeRow').then((module) => module.removeRowCommand) },
  { name: 'UPDATE_ROW', load: () => import('./updateRow').then((module) => module.updateRowCommand) },
  { name: 'MOVE_ROW', load: () => import('./moveRow').then((module) => module.moveRowCommand) },
  { name: 'ADD_TAB', load: () => import('./addTab').then((module) => module.addTabCommand) },
  { name: 'REMOVE_TAB', load: () => import('./removeTab').then((module) => module.removeTabCommand) },
  { name: 'UPDATE_TAB', load: () => import('./updateTab').then((module) => module.updateTabCommand) },
  { name: 'MOVE_TAB', load: () => import('./moveTab').then((module) => module.moveTabCommand) },
  { name: 'MOVE_PANEL', load: () => import('./movePanel').then((module) => module.movePanelCommand) },
  { name: 'UPDATE_LAYOUT', load: () => import('./updateLayout').then((module) => module.updateLayoutCommand) },
  { name: 'ADD_PANEL', load: () => import('./addPanel').then((module) => module.addPanelCommand) },
  { name: 'UPDATE_PANEL', load: () => import('./updatePanel').then((module) => module.updatePanelCommand) },
  { name: 'REMOVE_PANEL', load: () => import('./removePanel').then((module) => module.removePanelCommand) },
  { name: 'LIST_PANELS', load: () => import('./listPanels').then((module) => module.listPanelsCommand) },
  {
    name: 'GET_DASHBOARD_INFO',
    load: () => import('./getDashboardInfo').then((module) => module.getDashboardInfoCommand),
  },
  {
    name: 'UPDATE_DASHBOARD_SETTINGS',
    load: () => import('./updateDashboardSettings').then((module) => module.updateDashboardSettingsCommand),
  },
  { name: 'GET_SPEC', load: () => import('./getSpec').then((module) => module.getSpecCommand) },
  { name: 'APPLY_SPEC', load: () => import('./applySpec').then((module) => module.applySpecCommand) },
];
