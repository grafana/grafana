import { PanelPlugin, LogsSortOrder, LogsDedupStrategy, LogsDedupDescription } from '@grafana/data';
import { PanelOptions, defaultPanelOptions } from './models.gen';
import { LogsPanel } from './LogsPanel';

export const plugin = new PanelPlugin<PanelOptions>(LogsPanel).setPanelOptions((builder) => {
  builder
    .addBooleanSwitch({
      path: 'showTime',
      name: 'Time',
      description: '',
      defaultValue: defaultPanelOptions.showTime,
    })
    .addBooleanSwitch({
      path: 'showLabels',
      name: 'Unique labels',
      description: '',
      defaultValue: defaultPanelOptions.showLabels,
    })
    .addBooleanSwitch({
      path: 'wrapLogMessage',
      name: 'Wrap lines',
      description: '',
      defaultValue: defaultPanelOptions.wrapLogMessage,
    })
    .addBooleanSwitch({
      path: 'enableLogDetails',
      name: 'Enable log details',
      description: '',
      defaultValue: true,
    })
    .addRadio({
      path: 'dedupStrategy',
      name: 'Deduplication',
      description: '',
      settings: {
        options: [
          { value: LogsDedupStrategy.none, label: 'None', description: LogsDedupDescription[LogsDedupStrategy.none] },
          {
            value: LogsDedupStrategy.exact,
            label: 'Exact',
            description: LogsDedupDescription[LogsDedupStrategy.exact],
          },
          {
            value: LogsDedupStrategy.numbers,
            label: 'Numbers',
            description: LogsDedupDescription[LogsDedupStrategy.numbers],
          },
          {
            value: LogsDedupStrategy.signature,
            label: 'Signature',
            description: LogsDedupDescription[LogsDedupStrategy.signature],
          },
        ],
      },
      defaultValue: defaultPanelOptions.dedupStrategy,
    })
    .addRadio({
      path: 'sortOrder',
      name: 'Order',
      description: '',
      settings: {
        options: [
          { value: LogsSortOrder.Descending, label: 'Descending' },
          { value: LogsSortOrder.Ascending, label: 'Ascending' },
        ],
      },
      defaultValue: defaultPanelOptions.sortOrder,
    });
});
