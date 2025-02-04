import { PanelPlugin, LogsSortOrder, LogsDedupStrategy, LogsDedupDescription } from '@grafana/data';

import { LogsPanel } from './LogsPanel';
import { Options } from './panelcfg.gen';
import { LogsPanelSuggestionsSupplier } from './suggestions';

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
        path: 'wrapLogMessage',
        name: 'Wrap lines',
        description: '',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'enableLogDetails',
        name: 'Enable log details',
        description: '',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'enableInfiniteScrolling',
        name: 'Enable infinite scrolling',
        description: 'Experimental. Request more results by scrolling to the bottom of the logs list.',
        defaultValue: false,
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
