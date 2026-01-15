import { PanelPlugin } from '@grafana/data';

import { PrometheusInstantResultsPanel } from './PrometheusInstantResultsPanel';
import { prometheusInstantResultsMigrationHandler } from './migrations';
import { defaultOptions, Options } from './panelcfg.gen';
import { prometheusInstantResultsSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(PrometheusInstantResultsPanel)
  .setMigrationHandler(prometheusInstantResultsMigrationHandler)
  .setPanelOptions((builder) => {
    builder.addBooleanSwitch({
      path: 'expandedView',
      name: 'Expand results',
      description: 'Expand results by default',
      defaultValue: defaultOptions.expandedView,
    });
  })
  .setSuggestionsSupplier(prometheusInstantResultsSuggestionsSupplier);
