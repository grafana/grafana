import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { addTableCustomConfig } from 'app/features/panel/table/addTableCustomConfig';
import { addTableCustomPanelOptions } from 'app/features/panel/table/addTableCustomPanelOptions';

import { FieldConfig as TableFieldConfig, Options as TableOptions } from '../table/panelcfg.gen';

import { LogsTable } from './LogsTable';
import { defaultOptions, Options } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options & TableOptions, TableFieldConfig>(LogsTable)
  .useFieldConfig({
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
  })
  .setPanelOptions((builder) => {
    addTableCustomPanelOptions(builder);
    const logsTableCategory = [t('logstable.category-table', 'Logs Table')];
    builder
      .addBooleanSwitch({
        path: 'showInspectLogLine',
        name: t('logstable.show-inspect-button.name', 'Show inspect button'),
        category: logsTableCategory,
        description: t(
          'logstable.show-inspect-button.description',
          'Enables/disables the log line inspect button in the first column of each row'
        ),
        defaultValue: defaultOptions.showInspectLogLine,
      })
      .addBooleanSwitch({
        path: 'showCopyLogLink',
        name: t('logstable.show-copy-log.name', 'Show copy log link button'),
        category: logsTableCategory,
        description: t(
          'logstable.show-copy-log.description',
          'Enables/disables the log line link button in the first column of each row'
        ),
        defaultValue: defaultOptions.showCopyLogLink,
      })
      .addBooleanSwitch({
        path: 'showControls',
        name: t('logs.name-show-controls', 'Show controls'),
        category: logsTableCategory,
        description: t('logstable.description-show-controls', 'Display table controls'),
        defaultValue: defaultOptions.showControls ?? false,
      });
  });
