import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { transformDataFrames } from '../../../features/explore/TraceView/utils/transform';

import { TagsEditor } from './TagsEditor';
import { TracesPanel } from './TracesPanel';
import { TracesSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin(TracesPanel)
  .setPanelOptions((builder, context) => {
    const category = [t('traces.category-span-filters', 'Span filters')];
    const trace = transformDataFrames(context?.data?.[0]);

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
        name: t('traces.name-critical-path-only', 'Show critical path only'),
        defaultValue: false,
        category,
      });

    builder.addCustomEditor({
      id: 'tags',
      name: t('traces.name-tags', 'Tags'),
      path: 'spanFilters',
      category,
      editor: TagsEditor,
      defaultValue: undefined,
    });
  })
  .setSuggestionsSupplier(new TracesSuggestionsSupplier());
