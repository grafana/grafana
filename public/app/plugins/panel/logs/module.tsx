import { PanelPlugin } from '@grafana/data';
import { Options } from './types';
import { LogsPanel } from './LogsPanel';
import { SortOrder } from '../../../core/utils/explore';

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
          { value: SortOrder.Descending, label: 'Descending' },
          { value: SortOrder.Ascending, label: 'Ascending' },
        ],
      },
      defaultValue: SortOrder.Descending,
    });
});
