import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { type EditableVariableType } from './utils';

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

export const EDITABLE_VARIABLES_SELECT_ORDER: EditableVariableType[] = [
  'query',
  'custom',
  'textbox',
  'constant',
  'datasource',
  'interval',
  'adhoc',
  'switch',
  'groupby',
];

export interface VariableTypeSelectOptionsArgs {
  /**
   * True when the type selector renders outside a dashboard (e.g. the variables
   * management page). Standalone contexts have no dedicated "Filter and Group by"
   * entry point, so with unified drilldown controls the adhoc type stays selectable
   * and is relabeled accordingly.
   */
  standalone?: boolean;
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

export function getVariableTypeSelectOptions({ standalone }: VariableTypeSelectOptionsArgs = {}): Array<
  SelectableValue<EditableVariableType>
> {
  const metadata = getEditableVariablesMetadata();
  const unifiedDrilldown = Boolean(config.featureToggles.dashboardUnifiedDrilldownControls);

  const results = EDITABLE_VARIABLES_SELECT_ORDER.map(
    (variableType): SelectableValue<EditableVariableType> => ({
      label: getVariableTypeLabel(variableType, { standalone }),
      value: variableType,
      description:
        variableType === 'adhoc' && unifiedDrilldown && standalone
          ? t(
              'dashboard-scene.get-editable-variables.description.add-filters-and-group-by-keys-on-the-fly',
              'Add key/value filters and group by keys on the fly'
            )
          : metadata[variableType].description,
    })
  );

  return results.filter((option) => {
    // Legacy standalone groupby is experimental/deprecated; leave it gated only
    // by groupByVariable and focus new work on the unified adhoc path.
    if (!config.featureToggles.groupByVariable && option.value === 'groupby') {
      return false;
    }
    if (option.value === 'adhoc' && unifiedDrilldown && !standalone) {
      // Dashboards have a dedicated "Filter and Group by" entry point instead.
      return false;
    }

    return true;
  });
}
