import { useMemo } from 'react';

import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

import { changePanelFieldConfig, changePanelOptions } from '../../actions/panel/changePanelOptions';
import { getLibraryPanelBehavior } from '../../utils/utils';

import { LibraryPanelSidebarNotice } from './LibraryPanelSidebarNotice';
import { filterOptionsPaneCategories, getPanelSidebarOptionIds } from './panelSidebarOptions';

/**
 * The panel editor's visualization option categories, narrowed to the options configured for the
 * panel's visualization in PANEL_SIDEBAR_OPTIONS.
 */
export function usePanelSidebarVizOptions(panel: VizPanel): OptionsPaneCategoryDescriptor[] {
  const { options, fieldConfig, pluginId, _pluginInstanceState } = panel.useState();
  const { data } = sceneGraph.getData(panel).useState();
  const plugin = panel.getPlugin();

  return useMemo(() => {
    const itemIds = getPanelSidebarOptionIds(pluginId);
    if (!itemIds || !plugin || plugin.meta.id !== pluginId) {
      return [];
    }

    const categories = filterOptionsPaneCategories(
      getVisualizationOptions2({
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
      }),
      itemIds
    );

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
