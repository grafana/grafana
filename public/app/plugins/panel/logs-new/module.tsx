import { PanelPlugin, LogsSortOrder, LogsDedupStrategy, LogsDedupDescription } from '@grafana/data';
import { t } from '@grafana/i18n';

import { LogsPanel } from './LogsPanel';
import { Options } from './panelcfg.gen';
import { LogsPanelSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(LogsPanel)
  .setPanelOptions((builder) => {
    const category = [t('logs-new.category-logs', 'Logs')];
    builder
      .addBooleanSwitch({
        path: 'showTime',
        name: t('logs-new.name-time', 'Time'),
        category,
        description: '',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'wrapLogMessage',
        name: t('logs-new.name-wrap-lines', 'Wrap lines'),
        category,
        description: '',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'syntaxHighlighting',
        name: t('logs-new.name-syntax-highlighting', 'Enable syntax highlighting'),
        category,
        description: t(
          'logs-new.description-syntax-highlighting',
          'Use a predefined syntax coloring grammar to highlight relevant parts of the log lines'
        ),
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'enableLogDetails',
        name: t('logs-new.name-enable-log-details', 'Enable log details'),
        category,
        description: '',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showControls',
        name: t('logs-new.name-show-controls', 'Show controls'),
        category,
        description: t(
          'logs-new.description-show-controls',
          'Display controls to jump to the last or first log line, and filters by log level'
        ),
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'enableInfiniteScrolling',
        name: t('logs-new.name-infinite-scrolling', 'Enable infinite scrolling'),
        category,
        description: t(
          'logs-new.description-infinite-scrolling',
          'Experimental. Request more results by scrolling to the bottom of the logs list.'
        ),
        defaultValue: false,
      })
      .addRadio({
        path: 'dedupStrategy',
        name: t('logs-new.name-deduplication', 'Deduplication'),
        category,
        description: '',
        settings: {
          options: [
            {
              value: LogsDedupStrategy.none,
              label: t('logs-new.deduplication-options.label-none', 'None'),
              description: LogsDedupDescription[LogsDedupStrategy.none],
            },
            {
              value: LogsDedupStrategy.exact,
              label: t('logs-new.deduplication-options.label-exact', 'Exact'),
              description: LogsDedupDescription[LogsDedupStrategy.exact],
            },
            {
              value: LogsDedupStrategy.numbers,
              label: t('logs-new.deduplication-options.label-numbers', 'Numbers'),
              description: LogsDedupDescription[LogsDedupStrategy.numbers],
            },
            {
              value: LogsDedupStrategy.signature,
              label: t('logs-new.deduplication-options.label-signature', 'Signature'),
              description: LogsDedupDescription[LogsDedupStrategy.signature],
            },
          ],
        },
        defaultValue: LogsDedupStrategy.none,
      })
      .addRadio({
        path: 'sortOrder',
        name: t('logs-new.name-order', 'Order'),
        category,
        description: '',
        settings: {
          options: [
            { value: LogsSortOrder.Descending, label: t('logs-new.order-options.label-newest-first', 'Newest first') },
            { value: LogsSortOrder.Ascending, label: t('logs-new.order-options.label-oldest-first', 'Oldest first') },
          ],
        },
        defaultValue: LogsSortOrder.Descending,
      });
  })
  .setSuggestionsSupplier(new LogsPanelSuggestionsSupplier());
