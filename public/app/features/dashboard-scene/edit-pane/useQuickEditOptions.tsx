import { get as lodashGet } from 'lodash';
import { useMemo } from 'react';

import { PanelOptionsEditorBuilder, PanelPlugin, StandardEditorContext } from '@grafana/data';
import { isNestedPanelOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

import { DashboardInteractions } from '../utils/interactions';

import { DashboardEditActionEvent } from './editActions';

interface UseQuickEditOptionsProps {
  panel: VizPanel;
  plugin: PanelPlugin | undefined;
  dashboardUid?: string;
}

/**
 * Hook to build quick edit options for a panel based on the plugin's quickEditPaths.
 *
 * Quick edit options appear in the dashboard edit pane, allowing users to modify
 * common panel settings without entering the full panel editor.
 *
 * @returns OptionsPaneCategoryDescriptor with the quick edit options, or null if none are defined
 */
export function useQuickEditOptions({
  panel,
  plugin,
  dashboardUid,
}: UseQuickEditOptionsProps): OptionsPaneCategoryDescriptor | null {
  const { options: currentOptions } = panel.useState();

  return useMemo((): OptionsPaneCategoryDescriptor | null => {
    if (!plugin) {
      return null;
    }

    const quickEditPaths = plugin.getQuickEditPaths();
    if (!quickEditPaths || quickEditPaths.length === 0) {
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

    const category = new OptionsPaneCategoryDescriptor({
      title: t('dashboard.quick-edit.category-title', 'Quick edit'),
      id: 'quick-edit-options',
    });

    for (const path of quickEditPaths) {
      const item = allItems.find((opt) => opt.path === path);

      if (!item) {
        console.warn(
          `useQuickEditOptions: Quick edit path "${path}" not found in plugin options for "${plugin.meta?.id ?? 'unknown'}". ` +
            `Make sure the path matches an option defined in setPanelOptions().`
        );
        continue;
      }

      if (isNestedPanelOptions(item)) {
        console.warn(
          `useQuickEditOptions: Quick edit path "${path}" refers to a nested options group, which is not supported. ` +
            `Use paths to individual options instead.`
        );
        continue;
      }

      if (item.showIf && !item.showIf(context.options, context.data, context.annotations)) {
        continue;
      }

      const Editor = item.editor;
      const htmlId = `quick-edit-${item.id}`;
      const optionPath = item.path;

      // Build display name including category for nested options
      const displayName =
        item.category && item.category.length > 0 ? `${item.category.join(' > ')} ${item.name}` : item.name;
      const optionName = displayName;

      category.addItem(
        new OptionsPaneItemDescriptor({
          title: displayName,
          id: htmlId,
          description: item.description,
          render: function renderQuickEditOption() {
            const currentValue = lodashGet(currentOptions, optionPath);

            const handleChange = (newValue: unknown) => {
              const oldValue = currentValue;
              const newOptions = setOptionImmutably(currentOptions, optionPath, newValue);
              const panelType = plugin.meta?.id ?? 'unknown';

              DashboardInteractions.quickEditOptionChanged({
                panelType,
                optionPath,
                optionName,
                source: 'quick_edit',
                dashboardUid,
              });

              panel.publishEvent(
                new DashboardEditActionEvent({
                  description: t('dashboard.quick-edit.change-option', 'Change {{optionName}}', { optionName }),
                  source: panel,
                  perform: () => {
                    panel.onOptionsChange(newOptions);
                  },
                  undo: () => {
                    DashboardInteractions.quickEditOptionUndone({
                      panelType,
                      optionPath,
                      optionName,
                      dashboardUid,
                    });
                    const revertedOptions = setOptionImmutably(panel.state.options, optionPath, oldValue);
                    panel.onOptionsChange(revertedOptions);
                  },
                }),
                true
              );
            };

            return <Editor value={currentValue} onChange={handleChange} item={item} context={context} id={htmlId} />;
          },
        })
      );
    }

    if (category.items.length === 0) {
      return null;
    }

    return category;
  }, [panel, plugin, currentOptions, dashboardUid]);
}
