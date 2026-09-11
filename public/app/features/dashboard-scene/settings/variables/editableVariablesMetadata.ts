import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { type EditableVariableType, type VariableTypeSelectOptionsArgs } from './utils';

export interface EditableVariableMetadata {
  name: string;
  description: string;
}

/**
 * Display names and descriptions for each editable variable type. Kept separate from
 * the editor registry (`editableVariablesRegistry.ts`) so view-mode code can resolve
 * type labels without pulling every variable editor into the initial bundle.
 */
export const getEditableVariablesMetadata: () => Record<EditableVariableType, EditableVariableMetadata> = () => ({
  custom: {
    name: t('dashboard-scene.get-editable-variables.name.custom', 'Custom'),
    description: t(
      'dashboard-scene.get-editable-variables.description.values-are-static-and-defined-manually',
      'Values are static and defined manually'
    ),
  },
  query: {
    name: t('dashboard-scene.get-editable-variables.name.query', 'Query'),
    description: t(
      'dashboard-scene.get-editable-variables.description.values-fetched-source-query',
      'Values are fetched from a data source query'
    ),
  },
  constant: {
    name: t('dashboard-scene.get-editable-variables.name.constant', 'Constant'),
    description: t(
      'dashboard-scene.get-editable-variables.description.hidden-constant-variable',
      'A hidden constant variable, useful for metric prefixes in dashboards you want to share'
    ),
  },
  interval: {
    name: t('dashboard-scene.get-editable-variables.name.interval', 'Interval'),
    description: t(
      'dashboard-scene.get-editable-variables.description.values-timespans',
      'Values are timespans, ex 1m, 1h, 1d'
    ),
  },
  datasource: {
    name: t('dashboard-scene.get-editable-variables.name.data-source', 'Data source'),
    description: t(
      'dashboard-scene.get-editable-variables.description.dynamically-switch-source-multiple-panels',
      'Dynamically switch the data source for multiple panels'
    ),
  },
  adhoc: {
    name: t('dashboard-scene.get-editable-variables.name.ad-hoc-filters', 'Filter'),
    description: t(
      'dashboard-scene.get-editable-variables.description.add-keyvalue-filters-on-the-fly',
      'Add key/value filters on the fly'
    ),
  },
  groupby: {
    name: t('dashboard-scene.get-editable-variables.name.group-by', 'Group by'),
    description: t('dashboard-scene.get-editable-variables.description.group', 'Add keys to group by on the fly'),
  },
  textbox: {
    name: t('dashboard-scene.get-editable-variables.name.textbox', 'Textbox'),
    description: t(
      'dashboard-scene.get-editable-variables.description.users-enter-arbitrary-strings-textbox',
      'Users can enter any arbitrary strings in a textbox'
    ),
  },
  switch: {
    name: t('dashboard-scene.get-editable-variables.name.switch', 'Switch'),
    description: t(
      'dashboard-scene.get-editable-variables.description.users-enter-arbitrary-strings-switch',
      'A variable that can be toggled on and off'
    ),
  },
});

export function getEditableVariableMetadata(type: string): EditableVariableMetadata {
  const metadata = getEditableVariablesMetadata();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const entry = metadata[type as EditableVariableType];
  if (!entry) {
    throw new Error(`Variable type ${type} not found`);
  }

  return entry;
}

/**
 * Display label for a variable type, shared by the type selector and any list
 * views so the same variable is never called two different things. Under
 * unified drilldown controls the adhoc type is presented as "Filter and Group
 * by" in standalone contexts.
 */
export function getVariableTypeLabel(
  variableType: EditableVariableType,
  { standalone }: VariableTypeSelectOptionsArgs = {}
): string {
  if (variableType === 'adhoc' && standalone && config.featureToggles.dashboardUnifiedDrilldownControls) {
    return t('dashboard.sidebar.add.filters.label', 'Filter and Group by');
  }
  return getEditableVariablesMetadata()[variableType].name;
}
