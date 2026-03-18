import { useCallback, useMemo } from 'react';
import * as React from 'react';

import { FieldConfigSource, PanelData } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { OptionFilter, renderSearchHits } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getFieldOverrideCategories } from 'app/features/dashboard/components/PanelEditor/getFieldOverrideElements';
import {
  getLibraryVizPanelOptionsCategory,
  getVisualizationOptions2,
} from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { getDashboardSceneFor, getLibraryPanelBehavior, isLibraryPanel } from '../utils/utils';

import { getPanelFrameOptions, getPanelStylesOptions } from './getPanelFrameOptions';

interface Props {
  panel: VizPanel;
  searchQuery: string;
  listMode: OptionFilter;
  data?: PanelData;
}

export const PanelOptions = React.memo<Props>(({ panel, searchQuery, listMode, data }) => {
  const { options, fieldConfig, _pluginInstanceState } = panel.useState();

  const mutationHandlers = useMutationHandlers(panel);

  const panelFrameOptions = useMemo(() => getPanelFrameOptions(panel), [panel]);
  const panelStylesOptions = useMemo(() => getPanelStylesOptions(panel), [panel]);

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
      ...mutationHandlers,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, panel, options, fieldConfig, _pluginInstanceState, mutationHandlers]);

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
        mutationHandlers?.onFieldConfigChange ?? ((newConfig) => {
          panel.onFieldConfigChange(newConfig, true);
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, searchQuery, panel, fieldConfig, mutationHandlers]
  );

  const isSearching = searchQuery.length > 0;
  const mainBoxElements: React.ReactNode[] = [];

  if (isSearching) {
    mainBoxElements.push(
      renderSearchHits(
        [
          panelFrameOptions,
          ...(panelStylesOptions ? [panelStylesOptions] : []),
          ...(libraryPanelOptions ? [libraryPanelOptions] : []),
          ...(visualizationOptions ?? []),
        ],
        justOverrides,
        searchQuery
      )
    );
  } else {
    switch (listMode) {
      case OptionFilter.All:
        if (libraryPanelOptions) {
          // Library Panel options first
          mainBoxElements.push(libraryPanelOptions.renderElement());
        }
        mainBoxElements.push(panelFrameOptions.renderElement());
        if (panelStylesOptions) {
          mainBoxElements.push(panelStylesOptions.renderElement());
        }

        for (const item of visualizationOptions ?? []) {
          mainBoxElements.push(item.renderElement());
        }

        for (const item of justOverrides) {
          mainBoxElements.push(item.renderElement());
        }
        break;
      case OptionFilter.Overrides:
        for (const item of justOverrides) {
          mainBoxElements.push(item.renderElement());
        }
      default:
        break;
    }
  }

  return mainBoxElements;
});

PanelOptions.displayName = 'PanelOptions';

/**
 * Returns mutation-client-based handlers for options and field config changes.
 * Returns undefined handlers if the mutation client is not available,
 * in which case the callers fall back to direct VizPanel methods.
 */
function useMutationHandlers(panel: VizPanel) {
  const dashboard = useMemo(() => {
    try {
      return getDashboardSceneFor(panel);
    } catch {
      return undefined;
    }
  }, [panel]);

  const elementName = useMemo(
    () => dashboard?.getElementNameForVizPanel(panel),
    [dashboard, panel]
  );

  const client = dashboard?.getMutationClient();

  const onOptionsChange = useCallback(
    (options: Record<string, unknown>) => {
      if (client && elementName) {
        client.execute({
          type: 'UPDATE_PANEL',
          payload: {
            element: { kind: 'ElementReference', name: elementName },
            panel: { spec: { vizConfig: { spec: { options } } } },
          },
        });
      } else {
        panel.onOptionsChange(options);
      }
    },
    [client, elementName, panel]
  );

  const onFieldConfigChange = useCallback(
    (fieldConfig: FieldConfigSource) => {
      if (client && elementName) {
        client.execute({
          type: 'UPDATE_PANEL',
          payload: {
            element: { kind: 'ElementReference', name: elementName },
            panel: { spec: { vizConfig: { spec: { fieldConfig } } } },
          },
        });
      } else {
        panel.onFieldConfigChange(fieldConfig, true);
      }
    },
    [client, elementName, panel]
  );

  if (!client || !elementName) {
    return {};
  }

  return { onOptionsChange, onFieldConfigChange };
}
