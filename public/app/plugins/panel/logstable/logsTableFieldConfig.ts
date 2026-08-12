import {
  createFieldConfigRegistry,
  FieldConfigProperty,
  type FieldConfigOptionsRegistry,
  type SetFieldConfigOptionsArgs,
} from '@grafana/data';
import { addTableCustomConfig } from 'app/features/panel/table/addTableCustomConfig';

import { type FieldConfig as TableFieldConfig } from '../table/panelcfg.gen';

/**
 * Shared field config for the Logs Table panel. Used by module.tsx (`useFieldConfig`)
 * and by useExtractFields (`applyFieldOverrides`) so overrides like `custom.width` resolve
 * without importing `module.tsx` (avoids cycle: module → LogsTable → useExtractFields).
 */
export const logsTablePanelFieldConfig: SetFieldConfigOptionsArgs<TableFieldConfig> = {
  standardOptions: {
    [FieldConfigProperty.Actions]: {
      hideFromDefaults: false,
    },
  },
  useCustomConfig: (builder) => {
    addTableCustomConfig(builder, {
      filters: true,
      wrapHeaderText: true,
      hideFields: true,
    });
  },
};

let fieldConfigRegistry: FieldConfigOptionsRegistry | undefined;

/**
 * Lazily builds the same registry shape as {@link logsTablePanelFieldConfig} so Jest can
 * call `standardEditorsRegistry.setInit` before this runs (addTableCustomConfig needs it).
 */
export function getLogsTableFieldConfigRegistry(): FieldConfigOptionsRegistry {
  fieldConfigRegistry ??= createFieldConfigRegistry(logsTablePanelFieldConfig, 'Logs Table');
  return fieldConfigRegistry;
}
