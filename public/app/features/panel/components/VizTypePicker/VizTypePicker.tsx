import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2, PanelData, PanelPluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, EmptySearchResult, useStyles2, LinkButton } from '@grafana/ui';
import { VisualizationSelectPaneTab } from 'app/features/dashboard/components/PanelEditor/types';

import { filterPluginList, getAllPanelPluginMeta, getVizPluginMeta, getWidgetPluginMeta } from '../../state/util';

import { VizTypePickerPlugin } from './VizTypePickerPlugin';
import { VizTypeChangeDetails } from './types';

export interface Props {
  current: PanelPluginMeta;
  data?: PanelData;
  onChange: (options: VizTypeChangeDetails) => void;
  searchQuery: string;
  onClose: () => void;
  isWidget?: boolean;
  onTabChange?: (tab: VisualizationSelectPaneTab) => void;
}

export function VizTypePicker({ searchQuery, onChange, current, data, isWidget = false, onTabChange }: Props) {
  const styles = useStyles2(getStyles);
  const pluginsList: PanelPluginMeta[] = useMemo(() => {
    if (config.featureToggles.vizAndWidgetSplit) {
      if (isWidget) {
        return getWidgetPluginMeta();
      }
      return getVizPluginMeta();
    }
    return getAllPanelPluginMeta();
  }, [isWidget]);

  const filteredPluginTypes = useMemo((): PanelPluginMeta[] => {
    return filterPluginList(pluginsList, searchQuery, current);
  }, [current, pluginsList, searchQuery]);

  if (filteredPluginTypes.length === 0 && !config.featureToggles.vizAndWidgetSplit) {
    return <EmptySearchResult>Could not find anything matching your query</EmptySearchResult>;
  } else if (filteredPluginTypes.length === 0 && config.featureToggles.vizAndWidgetSplit && !isWidget) {
    return (
      <EmptySearchResult>
        <>
          Could not find any visualization matching your query. Are you looking for a{' '}
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <a className="external-link" onClick={() => onTabChange && onTabChange(VisualizationSelectPaneTab.Widgets)}>
            Widget
          </a>{' '}
          ?
        </>
      </EmptySearchResult>
    );
  } else if (filteredPluginTypes.length === 0 && config.featureToggles.vizAndWidgetSplit && isWidget) {
    return (
      <EmptySearchResult>
        <div>
          Could not find any widget matching your query. Are you looking for a{' '}
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <a
            className="external-link"
            onClick={() => onTabChange && onTabChange(VisualizationSelectPaneTab.Visualizations)}
          >
            Visualization
          </a>
          ?
        </div>
      </EmptySearchResult>
    );
  }

  return (
    <div className={styles.grid}>
      {filteredPluginTypes.map((plugin, index) => (
        <VizTypePickerPlugin
          disabled={false}
          key={plugin.id}
          isCurrent={plugin.id === current.id}
          plugin={plugin}
          onClick={(e) =>
            onChange({
              pluginId: plugin.id,
              withModKey: Boolean(e.metaKey || e.ctrlKey || e.altKey),
            })
          }
        />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    grid: css`
      max-width: 100%;
      display: grid;
      grid-gap: ${theme.spacing(0.5)};
    `,
    heading: css({
      ...theme.typography.h5,
      margin: theme.spacing(0, 0.5, 1),
    }),
  };
};
