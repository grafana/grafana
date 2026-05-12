import { useMemo } from 'react';
import * as React from 'react';

import { type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { OptionFilter, renderSearchHits } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getFieldOverrideCategories } from 'app/features/dashboard/components/PanelEditor/getFieldOverrideElements';
import {
  getLibraryVizPanelOptionsCategory,
  getVisualizationOptions2,
} from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { getLibraryPanelBehavior, isLibraryPanel } from '../utils/utils';

import { type TabId, getCategoryTab } from './categoryRouting';
import { type InspectorMode } from './PanelInspectorModeToggle';
import { TimeSeriesStyleCards } from './TimeSeriesStyleCards';
import { getPanelFrameOptions, getPanelStylesOptions } from './getPanelFrameOptions';

interface Props {
  panel: VizPanel;
  searchQuery: string;
  listMode: OptionFilter;
  data?: PanelData;
  activeTab: TabId;
  inspectorMode: InspectorMode;
}

export const PanelOptions = React.memo<Props>(({ panel, searchQuery, listMode, data, activeTab, inspectorMode }) => {
  const { options, fieldConfig, _pluginInstanceState } = panel.useState();

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
  } else if (listMode === OptionFilter.Overrides) {
    for (const item of justOverrides) {
      mainBoxElements.push(item.renderElement());
    }
  } else {
    // Tab-based rendering
    switch (activeTab) {
      case 'viz':
        if (libraryPanelOptions) {
          mainBoxElements.push(libraryPanelOptions.renderElement());
        }
        mainBoxElements.push(panelFrameOptions.renderElement());
        if (panelStylesOptions) {
          mainBoxElements.push(panelStylesOptions.renderElement());
        }
        break;

      case 'style': {
        const { pluginId } = panel.state;
        if (pluginId === 'timeseries') {
          mainBoxElements.push(
            <TimeSeriesStyleCards key="ts-style" panel={panel} inspectorMode={inspectorMode} />
          );
        } else {
          const vizCats = (visualizationOptions ?? []).filter(
            (cat) => getCategoryTab(cat.props.title) === 'style'
          );
          if (vizCats.length === 0) {
            mainBoxElements.push(
              <EmptyTabMessage
                key="empty"
                message={t('panel-edit.inspector-tab.empty-style', 'No options for this visualization in this tab.')}
              />
            );
          } else {
            for (const cat of vizCats) {
              mainBoxElements.push(cat.renderElement());
            }
          }
        }
        break;
      }

      case 'data': {
        const vizCats = (visualizationOptions ?? []).filter(
          (cat) => getCategoryTab(cat.props.title) === 'data'
        );
        if (vizCats.length === 0) {
          mainBoxElements.push(
            <EmptyTabMessage
              key="empty"
              message={t(
                'panel-edit.inspector-tab.empty-style',
                'No options for this visualization in this tab.'
              )}
            />
          );
        } else {
          for (const cat of vizCats) {
            mainBoxElements.push(cat.renderElement());
          }
        }
        break;
      }

      case 'rules': {
        const rulesCats = (visualizationOptions ?? []).filter(
          (cat) => getCategoryTab(cat.props.title) === 'rules'
        );
        for (const cat of rulesCats) {
          mainBoxElements.push(cat.renderElement());
        }
        for (const item of justOverrides) {
          mainBoxElements.push(item.renderElement());
        }
        if (rulesCats.length === 0 && justOverrides.length === 0) {
          mainBoxElements.push(
            <EmptyTabMessage
              key="empty"
              message={t(
                'panel-edit.inspector-tab.empty-rules',
                'No rules for this panel type. Overrides can still target any field.'
              )}
            />
          );
        }
        break;
      }
    }
  }

  return mainBoxElements;
});

PanelOptions.displayName = 'PanelOptions';

function EmptyTabMessage({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'inherit',
        opacity: 0.5,
      }}
    >
      {message}
    </div>
  );
}
