import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { migrateToAdhocFilters } from '../../../features/explore/TraceView/useSearch';

import { FiltersEditor } from './FiltersEditor';
import { TracesPanel } from './TracesPanel';
import { TracesSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin(TracesPanel)
  .setMigrationHandler((panel) => {
    // Migrate old span filters to new adhoc filters format
    if (panel.options?.spanFilters) {
      return {
        spanFilters: migrateToAdhocFilters(panel.options.spanFilters),
      };
    }
    return panel.options;
  })
  .setPanelOptions((builder) => {
    const category = [t('traces.category-span-filters', 'Span filters')];

    builder.addCustomEditor({
      id: 'filters',
      name: t('traces.name-filters', 'Filters'),
      path: 'spanFilters',
      category,
      editor: FiltersEditor,
      defaultValue: undefined,
    });

    // Find
    builder
      .addBooleanSwitch({
        path: 'spanFilters.matchesOnly',
        name: t('traces.name-show-matches-only', 'Show matches only'),
        defaultValue: false,
        category,
      })
      .addBooleanSwitch({
        path: 'spanFilters.criticalPathOnly',
        name: t('traces.name-critical-path-only', 'Select critical path'),
        defaultValue: false,
        category,
      });
  })
  .setSuggestionsSupplier(new TracesSuggestionsSupplier());
