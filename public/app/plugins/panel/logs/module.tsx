import { PanelPlugin, LogsSortOrder } from '@grafana/data';
import { Options } from './types';
import { LogsPanel } from './LogsPanel';

export const plugin = new PanelPlugin<Options>(LogsPanel).setPanelOptions(builder => {
  builder
    .addBooleanSwitch({
      path: 'showTime',
      name: 'Time',
      description: '',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'showLabels',
      name: 'Unique labels',
      description: '',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'wrapLogMessage',
      name: 'Wrap lines',
      description: '',
      defaultValue: false,
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
      defaultValue: LogsSortOrder.Descending,
    });
});
