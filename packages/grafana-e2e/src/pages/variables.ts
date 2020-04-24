import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const Variables = pageFactory({
  url: '',
  selectors: selectors.pages.Dashboard.Settings.Variables.List,
});

export const VariablesSubMenu = pageFactory({
  url: '',
  selectors: selectors.pages.Dashboard.SubMenu,
});

export const VariableGeneral = pageFactory({
  url: '',
  selectors: selectors.pages.Dashboard.Settings.Variables.Edit.General,
});

export const QueryVariable = pageFactory({
  url: '',
  selectors: selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable,
});

export const ConstantVariable = pageFactory({
  url: '',
  selectors: selectors.pages.Dashboard.Settings.Variables.Edit.ConstantVariable,
});
