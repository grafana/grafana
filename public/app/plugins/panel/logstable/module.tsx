import { PanelPlugin } from '@grafana/data';

import { LogsTable } from './LogsTable';
import { Options } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(LogsTable).setPanelOptions((builder) => {
  builder.addBooleanSwitch({
    path: 'wrapLogMessage',
    name: 'Wrap lines',
    description: '',
    defaultValue: false,
  });

  // @todo add table options?
  //
  // .addRadio({
  //   path: 'dedupStrategy',
  //   name: 'Deduplication',
  //   description: '',
  //   settings: {
  //     options: [
  //       { value: LogsDedupStrategy.none, label: 'None', description: LogsDedupDescription[LogsDedupStrategy.none] },
  //       {
  //         value: LogsDedupStrategy.exact,
  //         label: 'Exact',
  //         description: LogsDedupDescription[LogsDedupStrategy.exact],
  //       },
  //       {
  //         value: LogsDedupStrategy.numbers,
  //         label: 'Numbers',
  //         description: LogsDedupDescription[LogsDedupStrategy.numbers],
  //       },
  //       {
  //         value: LogsDedupStrategy.signature,
  //         label: 'Signature',
  //         description: LogsDedupDescription[LogsDedupStrategy.signature],
  //       },
  //     ],
  //   },
  //   defaultValue: LogsDedupStrategy.none,
  // })
  // .addRadio({
  //   path: 'sortOrder',
  //   name: 'Order',
  //   description: '',
  //   settings: {
  //     options: [
  //       { value: LogsSortOrder.Descending, label: 'Newest first' },
  //       { value: LogsSortOrder.Ascending, label: 'Oldest first' },
  //     ],
  //   },
  //   defaultValue: LogsSortOrder.Descending,
  // });
});
