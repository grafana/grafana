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
            { value: LogsDedupStrategy.None, label: 'None', description: LogsDedupDescription[LogsDedupStrategy.None] },
            {
              value: LogsDedupStrategy.Exact,
              label: 'Exact',
              description: LogsDedupDescription[LogsDedupStrategy.Exact],
            },
            {
              value: LogsDedupStrategy.Numbers,
              label: 'Numbers',
              description: LogsDedupDescription[LogsDedupStrategy.Numbers],
            },
            {
              value: LogsDedupStrategy.Signature,
              label: 'Signature',
              description: LogsDedupDescription[LogsDedupStrategy.Signature],
            },
          ],
        },
        defaultValue: LogsDedupStrategy.None,
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
