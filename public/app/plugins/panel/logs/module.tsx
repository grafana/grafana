import { PanelPlugin, LogsSortOrder, LogsDedupStrategy, LogsDedupDescription } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { LogsPanel } from './LogsPanel';
import { Options } from './panelcfg.gen';
import { LogsPanelSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(LogsPanel)
  .setPanelOptions((builder) => {
    const category = [t('logs.category-logs', 'Logs')];
    builder.addBooleanSwitch({
      path: 'showTime',
      name: t('logs.name-time', 'Show timestamps'),
      category,
      description: '',
      defaultValue: false,
    });

    if (!config.featureToggles.newLogsPanel) {
      builder
        .addBooleanSwitch({
          path: 'showLabels',
          name: t('logs.name-unique-labels', 'Unique labels'),
          category,
          description: '',
          defaultValue: false,
        })
        .addBooleanSwitch({
          path: 'showCommonLabels',
          name: t('logs.name-common-labels', 'Common labels'),
          category,
          description: '',
          defaultValue: false,
        });
    } else {
      builder.addRadio({
          path: 'timestampResolution',
          name: t('logs.timestamp-format', 'Timestamp resolution'),
          category,
          description: '',
          settings: {
            options: [
              { value: 'default', label: t('logs.logs.timestamp-resolution.label-milliseconds', 'Milliseconds') },
              {
                value: 'small',
                label: t('logs.logs.timestamp-resolution.label-nanoseconds', 'Nanoseconds'),
              },
            ],
          },
        })
    }

    builder.addBooleanSwitch({
      path: 'wrapLogMessage',
      name: t('logs.name-wrap-lines', 'Wrap lines'),
      category,
      description: '',
      defaultValue: false,
    });

    if (config.featureToggles.newLogsPanel) {
      builder.addBooleanSwitch({
        path: 'syntaxHighlighting',
        name: t('logs.name-enable-syntax-highlighting', 'Enable syntax highlighting'),
        category,
        description: t(
          'logs.description-enable-syntax-highlighting',
          'Use a predefined syntax coloring grammar to highlight relevant parts of the log lines'
        ),
      });
    } else {
      builder.addBooleanSwitch({
        path: 'prettifyLogMessage',
        name: t('logs.name-prettify-json', 'Prettify JSON'),
        category,
        description: '',
        defaultValue: false,
      });
    }

    builder
      .addBooleanSwitch({
        path: 'enableLogDetails',
        name: t('logs.name-enable-log-details', 'Enable log details'),
        category,
        description: '',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'enableInfiniteScrolling',
        name: t('logs.name-enable-infinite-scrolling', 'Enable infinite scrolling'),
        category,
        description: t(
          'logs.description-enable-infinite-scrolling',
          'Experimental. Request more results by scrolling to the bottom of the logs list.'
        ),
        defaultValue: false,
      });

    if (config.featureToggles.newLogsPanel) {
      builder
        .addBooleanSwitch({
          path: 'showControls',
          name: t('logs.name-show-controls', 'Show controls'),
          category,
          description: t(
            'logs.description-show-controls',
            'Display controls to jump to the last or first log line, and filters by log level'
          ),
          defaultValue: false,
        })
        .addRadio({
          path: 'fontSize',
          name: t('logs.name-font-size', 'Font size'),
          category,
          description: '',
          settings: {
            options: [
              { value: 'default', label: t('logs.font-size-options.label-default', 'Default') },
              {
                value: 'small',
                label: t('logs.font-size-options.label-small', 'Small'),
              },
            ],
          },
        })
        .addRadio({
          path: 'detailsMode',
          name: t('logs.name-details-mode', 'Log Details panel mode'),
          category,
          description: '',
          settings: {
            options: [
              { value: 'inline', label: t('logs.name-details-options.label-inline', 'Inline') },
              {
                value: 'sidebar',
                label: t('logs.name-details-options.label-sidebar', 'Sidebar'),
              },
            ],
          },
        });
    }

    builder
      .addRadio({
        path: 'dedupStrategy',
        name: t('logs.name-deduplication', 'Deduplication'),
        category,
        description: '',
        settings: {
          options: [
            {
              value: LogsDedupStrategy.none,
              label: t('logs.deduplication-options.label-none', 'None'),
              description: LogsDedupDescription[LogsDedupStrategy.none],
            },
            {
              value: LogsDedupStrategy.exact,
              label: t('logs.deduplication-options.label-exact', 'Exact'),
              description: LogsDedupDescription[LogsDedupStrategy.exact],
            },
            {
              value: LogsDedupStrategy.numbers,
              label: t('logs.deduplication-options.label-numbers', 'Numbers'),
              description: LogsDedupDescription[LogsDedupStrategy.numbers],
            },
            {
              value: LogsDedupStrategy.signature,
              label: t('logs.deduplication-options.label-signature', 'Signature'),
              description: LogsDedupDescription[LogsDedupStrategy.signature],
            },
          ],
        },
        defaultValue: LogsDedupStrategy.none,
      })
      .addRadio({
        path: 'sortOrder',
        name: t('logs.name-order', 'Order'),
        category,
        description: '',
        settings: {
          options: [
            { value: LogsSortOrder.Descending, label: t('logs.order-options.label-newest-first', 'Newest first') },
            { value: LogsSortOrder.Ascending, label: t('logs.order-options.label-oldest-first', 'Oldest first') },
          ],
        },
        defaultValue: LogsSortOrder.Descending,
      });
  })
  .setSuggestionsSupplier(new LogsPanelSuggestionsSupplier());
