import { useMemo } from 'react';
import * as React from 'react';

import { PanelData } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { OptionFilter, renderSearchHits } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getFieldOverrideCategories } from 'app/features/dashboard/components/PanelEditor/getFieldOverrideElements';
import {
  getLibraryVizPanelOptionsCategory,
  getVisualizationOptions2,
} from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { getLibraryPanelBehavior, isLibraryPanel } from '../utils/utils';

import { getPanelFrameOptions } from './getPanelFrameOptions';

interface Props {
  panel: VizPanel;
  searchQuery: string;
  listMode: OptionFilter;
  data?: PanelData;
}

export const PanelOptions = React.memo<Props>(({ panel, searchQuery, listMode, data }) => {
  const { options, fieldConfig, _pluginInstanceState } = panel.useState();

  const panelFrameOptions = useMemo(() => getPanelFrameOptions(panel), [panel]);

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
  }, [data, panel, options, fieldConfig, _pluginInstanceState]);

  const libraryPanelOptions = useMemo(() => {
    if (panel instanceof VizPanel && isLibraryPanel(panel)) {
      const behavior = getLibraryPanelBehavior(panel);

      if (!(behavior instanceof LibraryPanelBehavior)) {
        return;
      }

      return getLibraryVizPanelOptionsCategory(behavior);
    }
    return;
  }, [panel]);

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
    [data, searchQuery, panel, fieldConfig]
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
