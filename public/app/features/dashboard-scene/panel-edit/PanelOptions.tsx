import React, { useMemo } from 'react';

import { sceneGraph } from '@grafana/scenes';
import { OptionFilter, renderSearchHits } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getFieldOverrideCategories } from 'app/features/dashboard/components/PanelEditor/getFieldOverrideElements';
import { getPanelFrameCategory2 } from 'app/features/dashboard/components/PanelEditor/getPanelFrameOptions';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

import { VizPanelManager } from './VizPanelManager';

interface Props {
  vizManager: VizPanelManager;
  searchQuery: string;
  listMode: OptionFilter;
}

export const PanelOptions = React.memo<Props>(({ vizManager, searchQuery, listMode }) => {
  const { panel } = vizManager.state;
  const { data } = sceneGraph.getData(panel).useState();
  const { options, fieldConfig } = panel.useState();

  const panelFrameOptions = useMemo(() => getPanelFrameCategory2(panel), [panel]);

  const visualizationOptions = useMemo(() => {
    const plugin = panel.getPlugin();
    if (!plugin) {
      return undefined;
    }

    return getVisualizationOptions2({
      panel,
      plugin: plugin,
      eventBus: panel.getPanelContext().eventBus,
      instanceState: panel.getPanelContext().instanceState!,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, options, fieldConfig]);

  const justOverrides = useMemo(
    () =>
      getFieldOverrideCategories(
        fieldConfig,
        panel.getPlugin()?.fieldConfigRegistry!,
        data?.series ?? [],
        searchQuery,
        (newConfig) => {
          panel.setState({
            fieldConfig: newConfig,
          });
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, panel, fieldConfig]
  );

  const isSearching = searchQuery.length > 0;
  const mainBoxElements: React.ReactNode[] = [];

  if (isSearching) {
    mainBoxElements.push(
      renderSearchHits([panelFrameOptions, ...(visualizationOptions ?? [])], justOverrides, searchQuery)
    );
  } else {
    switch (listMode) {
      case OptionFilter.All:
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
