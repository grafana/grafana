import React, { useMemo } from 'react';

import { PanelData } from '@grafana/data';
import { OptionFilter, renderSearchHits } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getFieldOverrideCategories } from 'app/features/dashboard/components/PanelEditor/getFieldOverrideElements';
import {
  getLibraryVizPanelOptionsCategory,
  getVisualizationOptions2,
} from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

import { LibraryVizPanel } from '../scene/LibraryVizPanel';

import { VizPanelManager } from './VizPanelManager';
import { getPanelFrameCategory2 } from './getPanelFrameOptions';

interface Props {
  vizManager: VizPanelManager;
  searchQuery: string;
  listMode: OptionFilter;
  data?: PanelData;
}

export const PanelOptions = React.memo<Props>(({ vizManager, searchQuery, listMode, data }) => {
  const { panel, sourcePanel, repeat } = vizManager.useState();
  const parent = sourcePanel.resolve().parent;
  const { options, fieldConfig, _pluginInstanceState } = panel.useState();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const panelFrameOptions = useMemo(
    () => getPanelFrameCategory2(vizManager, panel, repeat),
    [vizManager, panel, repeat]
  );

  const visualizationOptions = useMemo(() => {
    const plugin = panel.getPlugin();
    if (!plugin) {
      return undefined;
    }

    return getVisualizationOptions2({
      panel,
      data,
      plugin: plugin,
      eventBus: panel.getPanelContext().eventBus,
      instanceState: _pluginInstanceState,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, options, fieldConfig, _pluginInstanceState]);

  const libraryPanelOptions = useMemo(() => {
    if (parent instanceof LibraryVizPanel) {
      return getLibraryVizPanelOptionsCategory(parent);
    }
    return;
  }, [parent]);

  const justOverrides = useMemo(
    () =>
      getFieldOverrideCategories(
        fieldConfig,
        panel.getPlugin()?.fieldConfigRegistry!,
        data?.series ?? [],
        searchQuery,
        (newConfig) => {
          panel.onFieldConfigChange(newConfig, true);
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, panel, fieldConfig]
  );

  const isSearching = searchQuery.length > 0;
  const mainBoxElements: React.ReactNode[] = [];

  if (isSearching) {
    mainBoxElements.push(
      renderSearchHits(
        [panelFrameOptions, ...(libraryPanelOptions ? [libraryPanelOptions] : []), ...(visualizationOptions ?? [])],
        justOverrides,
        searchQuery
      )
    );
  } else {
    switch (listMode) {
      case OptionFilter.All:
        if (libraryPanelOptions) {
          // Library Panel options first
          mainBoxElements.push(libraryPanelOptions.render());
        }
        mainBoxElements.push(panelFrameOptions.render());

        for (const item of visualizationOptions ?? []) {
          mainBoxElements.push(item.render());
        }

        for (const item of justOverrides) {
          mainBoxElements.push(item.render());
        }
        break;
      case OptionFilter.Overrides:
        for (const item of justOverrides) {
          mainBoxElements.push(item.render());
        }
      default:
        break;
    }
  }

  return mainBoxElements;
});

PanelOptions.displayName = 'PanelOptions';
