import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { addTableCustomPanelOptions } from 'app/features/panel/table/addTableCustomPanelOptions';

import { type FieldConfig as TableFieldConfig, type Options as TableOptions } from '../table/panelcfg.gen';

import { LogsTable } from './LogsTable';
import { logsTablePanelFieldConfig } from './logsTableFieldConfig';
import { defaultOptions, type Options } from './panelcfg.gen';
import { logstableSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options & TableOptions, TableFieldConfig>(LogsTable)
  .useFieldConfig(logsTablePanelFieldConfig)
  .setPanelOptions((builder) => {
    addTableCustomPanelOptions(builder);
    const logsTableCategory = [t('logstable.category-table', 'Logs Table')];
    builder
      .addBooleanSwitch({
        path: 'enableLogDetails',
        name: t('logstable.enable-log-details.name', 'Enable log details'),
        category: logsTableCategory,
        description: t('logstable.enable-log-details.description', 'When enabled, shows log details for each row.'),
        defaultValue: defaultOptions.enableLogDetails,
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
      }).addBooleanSwitch({
        path: 'allowDownload',
        name: t('logs.name-allow-download', 'Display download control'),
        category: logsTableCategory,
        description: t(
          'logs.description-allow-download',
          'When controls are enabled, show an option to download the logs on display.'
        ),
        showIf: (currentOptions) => Boolean(currentOptions.showControls),
      })
  })
  .setSuggestionsSupplier(logstableSuggestionsSupplier);
