import { FieldConfigProperty, PanelPlugin } from '@grafana/data';

import { TablePanel } from './TablePanel';
import { addTableCustomConfig } from './addTableCustomConfig';
import { addTableCustomPanelOptions } from './addTableCustomPanelOptions';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { FieldConfig, Options } from './panelcfg.gen';
import { tableSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options, FieldConfig>(TablePanel)
  .setPanelChangeHandler(tablePanelChangedHandler)
  .setMigrationHandler(tableMigrationHandler)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Actions]: {
        hideFromDefaults: false,
      },
    },
    useCustomConfig: (builder) => {
      addTableCustomConfig(builder);
    },
  })
  .setPanelOptions((builder) => {
    addTableCustomPanelOptions(builder);
  })
  .setSuggestionsSupplier(tableSuggestionsSupplier);
