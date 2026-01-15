import { PanelPlugin } from '@grafana/data';

import { InstantQueryResultsPanel } from './InstantQueryResultsPanel';
import { defaultOptions, Options } from './panelcfg.gen';
import { instantQueryResultsSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(InstantQueryResultsPanel)
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'displayMode',
        name: 'Display mode',
        description: 'Choose between table and raw view',
        defaultValue: defaultOptions.displayMode,
        settings: {
          options: [
            { value: 'table', label: 'Table' },
            { value: 'raw', label: 'Raw' },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'showToggle',
        name: 'Show toggle',
        description: 'Show the Table/Raw toggle in the panel header',
        defaultValue: defaultOptions.showToggle,
      })
      .addBooleanSwitch({
        path: 'expandedRawView',
        name: 'Expand raw view',
        description: 'Expand results in raw view by default',
        defaultValue: defaultOptions.expandedRawView,
        showIf: (config) => config.displayMode === 'raw',
      });
  })
  .setSuggestionsSupplier(instantQueryResultsSuggestionsSupplier);
