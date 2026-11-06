import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

import { changePanelFieldConfig, changePanelOptions } from '../../actions/panel/changePanelOptions';
import { getLibraryPanelBehavior } from '../../utils/utils';

import { LibraryPanelSidebarNotice } from './LibraryPanelSidebarNotice';
import { TextNGSidebarEditor } from './TextNGSidebarEditor';
import { filterOptionsPaneCategories, getPanelSidebarOptionIds } from './panelSidebarOptions';

/**
 * The panel editor's visualization option categories, narrowed to the options configured for the
 * panel's visualization in PANEL_SIDEBAR_OPTIONS. The new text panel gets its in-panel editor instead.
 */
export function usePanelSidebarVizOptions(panel: VizPanel): OptionsPaneCategoryDescriptor[] {
  const { options, fieldConfig, pluginId, _pluginInstanceState } = panel.useState();
  const { data } = sceneGraph.getData(panel).useState();
  const plugin = panel.getPlugin();

  return useMemo(() => {
    const itemIds = getPanelSidebarOptionIds(pluginId);
    const isText = pluginId === 'text';
    if ((!itemIds && !isText) || !plugin || plugin.meta.id !== pluginId) {
      return [];
    }

    const allCategories = getVisualizationOptions2({
      panel,
      data,
      plugin,
      eventBus: panel.getPanelContext().eventBus,
      instanceState: _pluginInstanceState,
      currentOptions: options,
      currentFieldConfig: fieldConfig,
      onOptionsChange: (newOptions, name, category) => changePanelOptions(panel, newOptions, name, category),
      onFieldConfigChange: (newFieldConfig, name, category) =>
        changePanelFieldConfig(panel, newFieldConfig, name, category),
    });

    let categories: OptionsPaneCategoryDescriptor[] = [];
    if (isText) {
      // Only the new text panel, which hides its content option and edits it inside the panel. The
      // original text panel keeps the edit pane as it was. This looks at the loaded plugin rather than
      // the grafana.newTextPanel flag, which can read differently by the time the edit pane renders
      // than when the text module picked a version.
      if (!hasItem(allCategories, 'content')) {
        categories = [getTextNGEditorCategory(panel)];
      }
    } else if (itemIds) {
      categories = filterOptionsPaneCategories(allCategories, itemIds);
    }

    const libraryPanel = getLibraryPanelBehavior(panel);
    if (!libraryPanel || categories.length === 0) {
      return categories;
    }

    const libraryPanelNotice = new OptionsPaneCategoryDescriptor({
      title: '',
      id: 'library-panel-notice',
      customRender: () => (
        <LibraryPanelSidebarNotice key="library-panel-notice" panel={panel} libraryPanel={libraryPanel} />
      ),
    });

    return [libraryPanelNotice, ...categories];
  }, [panel, plugin, pluginId, data, options, fieldConfig, _pluginInstanceState]);
}

function getTextNGEditorCategory(panel: VizPanel): OptionsPaneCategoryDescriptor {
  const title = t('dashboard.sidebar.viz-panel.text-editor.category', 'Text');

  return new OptionsPaneCategoryDescriptor({ title, id: 'Text' }).addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.sidebar.viz-panel.text-editor.content', 'Content'),
      id: 'text-ng-editor',
      skipField: true,
      render: () => <TextNGSidebarEditor panel={panel} />,
    })
  );
}

function hasItem(categories: OptionsPaneCategoryDescriptor[], itemId: string): boolean {
  return categories.some(
    (category) => category.items.some((item) => item.props.id === itemId) || hasItem(category.categories, itemId)
  );
}
