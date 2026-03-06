import { get as lodashGet } from 'lodash';
import { useMemo } from 'react';

import { PanelOptionsEditorBuilder, PanelPlugin, StandardEditorContext } from '@grafana/data';
import { isNestedPanelOptions, NestedValueAccess } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

const MAX_QUICK_EDIT_OPTIONS = 5;

interface UseQuickEditOptionsProps {
  panel: VizPanel;
  plugin: PanelPlugin | undefined;
}

/**
 * Hook to build quick edit options for a panel based on options marked with `quickEdit: true`.
 *
 * Quick edit options appear in the dashboard edit pane, allowing users to modify
 * common panel settings without entering the full panel editor.
 *
 * Only the first 5 options with `quickEdit: true` will be shown.
 *
 * @returns OptionsPaneCategoryDescriptor with the quick edit options, or null if none are defined
 */
export function useQuickEditOptions({ panel, plugin }: UseQuickEditOptionsProps): OptionsPaneCategoryDescriptor | null {
  const { options: currentOptions } = panel.useState();

  return useMemo((): OptionsPaneCategoryDescriptor | null => {
    if (!plugin) {
      return null;
    }

    const supplier = plugin.getPanelOptionsSupplier();

    const context: StandardEditorContext<unknown, unknown> = {
      data: [],
      options: currentOptions,
      replaceVariables: panel.interpolate,
      eventBus: panel.getPanelContext().eventBus,
    };

    const builder = new PanelOptionsEditorBuilder();
    supplier(builder, context);

    const allItems = builder.getItems();

    // Filter to only items with quickEdit: true
    const quickEditItems = allItems.filter((item) => {
      if (isNestedPanelOptions(item)) {
        return false;
      }
      return item.quickEdit === true;
    });

    if (quickEditItems.length === 0) {
      return null;
    }

    // Warn if more than MAX_QUICK_EDIT_OPTIONS are defined
    if (quickEditItems.length > MAX_QUICK_EDIT_OPTIONS) {
      console.warn(
        `useQuickEditOptions: Plugin "${plugin.meta?.id ?? 'unknown'}" has ${quickEditItems.length} options with quickEdit: true, ` +
          `but only ${MAX_QUICK_EDIT_OPTIONS} are allowed. Extra options will be ignored.`
      );
    }

    const itemsToShow = quickEditItems.slice(0, MAX_QUICK_EDIT_OPTIONS);

    const access: NestedValueAccess = {
      getValue: (path) => lodashGet(currentOptions, path),
      onChange: (path, value) => {
        const newOptions = setOptionImmutably(currentOptions, path, value);
        panel.onOptionsChange(newOptions);
      },
    };

    const category = new OptionsPaneCategoryDescriptor({
      title: t('dashboard.quick-edit.category-title', 'Quick settings'),
      id: 'quick-edit-options',
    });

    for (const item of itemsToShow) {
      if (item.showIf && !item.showIf(context.options, context.data, context.annotations)) {
        continue;
      }

      const Editor = item.editor;
      const htmlId = `quick-edit-${item.id}`;

      category.addItem(
        new OptionsPaneItemDescriptor({
          title: item.name,
          id: htmlId,
          description: item.description,
          render: function renderQuickEditOption() {
            return (
              <Editor
                value={access.getValue(item.path)}
                onChange={(value) => {
                  access.onChange(item.path, value);
                }}
                item={item}
                context={context}
                id={htmlId}
              />
            );
          },
        })
      );
    }

    if (category.items.length === 0) {
      return null;
    }

    return category;
  }, [panel, plugin, currentOptions]);
}
