import { PanelPlugin, LogsSortOrder, LogsDedupStrategy, LogsDedupDescription } from '@grafana/data';

import { LogsPanel } from './LogsPanel';
import { LogsPanelSuggestionsSupplier } from './suggestions';
import { Options } from './types';

export const plugin = new PanelPlugin<Options>(LogsPanel)
  .setPanelOptions((builder) => {
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
        path: 'showCommonLabels',
        name: 'Common labels',
        description: '',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'wrapLogMessage',
        name: 'Wrap lines',
        description: '',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'prettifyLogMessage',
        name: 'Prettify JSON',
        description: '',
        defaultValue: false,
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
        defaultValue: LogsDedupStrategy.none,
      })
      .addRadio({
        path: 'sortOrder',
        name: 'Order',
        description: '',
        settings: {
          options: [
            { value: LogsSortOrder.Descending, label: 'Newest first' },
            { value: LogsSortOrder.Ascending, label: 'Oldest first' },
          ],
        },
        defaultValue: LogsSortOrder.Descending,
      });
  })
  .setSuggestionsSupplier(new LogsPanelSuggestionsSupplier());
