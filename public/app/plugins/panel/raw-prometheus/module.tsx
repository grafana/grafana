import { PanelPlugin } from '@grafana/data';

import { RawPrometheusPanel } from './RawPrometheusPanel';
import { rawPrometheusMigrationHandler } from './migrations';
import { defaultOptions, Options } from './panelcfg.gen';
import { rawPrometheusSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(RawPrometheusPanel)
  .setMigrationHandler(rawPrometheusMigrationHandler)
  .setPanelOptions((builder) => {
    builder.addBooleanSwitch({
      path: 'expandedView',
      name: 'Expand results',
      description: 'Expand results by default',
      defaultValue: defaultOptions.expandedView,
    });
  })
  .setSuggestionsSupplier(rawPrometheusSuggestionsSupplier);
