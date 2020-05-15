import React, { useCallback, useMemo } from 'react';

import config from 'app/core/config';
import VizTypePickerPlugin from './VizTypePickerPlugin';
import { EmptySearchResult, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, PanelPluginMeta, PluginState } from '@grafana/data';
import { css } from 'emotion';

export interface Props {
  current: PanelPluginMeta;
  onTypeChange: (newType: PanelPluginMeta) => void;
  searchQuery: string;
  onClose: () => void;
}

export function getAllPanelPluginMeta(): PanelPluginMeta[] {
  const allPanels = config.panels;

  return Object.keys(allPanels)
    .filter(key => allPanels[key]['hideFromList'] === false)
    .map(key => allPanels[key])
    .sort((a: PanelPluginMeta, b: PanelPluginMeta) => a.sort - b.sort);
}

export function filterPluginList(
  pluginsList: PanelPluginMeta[],
  searchQuery: string,
  current: PanelPluginMeta
): PanelPluginMeta[] {
  if (!searchQuery.length) {
    return pluginsList.filter(p => {
      if (p.state === PluginState.deprecated) {
        return current.id === p.id;
      }
      return true;
    });
  }
  const query = searchQuery.toLowerCase();
  const first: PanelPluginMeta[] = [];
  const match: PanelPluginMeta[] = [];
  for (const item of pluginsList) {
    if (item.state === PluginState.deprecated && current.id !== item.id) {
      continue;
    }
    const name = item.name.toLowerCase();
    const idx = name.indexOf(query);
    if (idx === 0) {
      first.push(item);
    } else if (idx > 0) {
      match.push(item);
    }
  }
  return first.concat(match);
}

export const VizTypePicker: React.FC<Props> = ({ searchQuery, onTypeChange, current }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const pluginsList: PanelPluginMeta[] = useMemo(() => {
    return getAllPanelPluginMeta();
  }, []);

  const getFilteredPluginList = useCallback((): PanelPluginMeta[] => {
    return filterPluginList(pluginsList, searchQuery, current);
  }, [searchQuery]);

  const renderVizPlugin = (plugin: PanelPluginMeta, index: number) => {
    const isCurrent = plugin.id === current.id;
    const filteredPluginList = getFilteredPluginList();

    const matchesQuery = filteredPluginList.indexOf(plugin) > -1;
    return (
      <VizTypePickerPlugin
        disabled={!matchesQuery && !!searchQuery}
        key={plugin.id}
        isCurrent={isCurrent}
        plugin={plugin}
        onClick={() => onTypeChange(plugin)}
      />
    );
  };

  const filteredPluginList = getFilteredPluginList();
  const hasResults = filteredPluginList.length > 0;
  const renderList = filteredPluginList.concat(pluginsList.filter(p => filteredPluginList.indexOf(p) === -1));

  return (
    <div className={styles.grid}>
      {hasResults ? (
        renderList.map((plugin, index) => {
          if (plugin.state === PluginState.deprecated) {
            return null;
          }
          return renderVizPlugin(plugin, index);
        })
      ) : (
        <EmptySearchResult>Could not find anything matching your query</EmptySearchResult>
      )}
    </div>
  );
};

VizTypePicker.displayName = 'VizTypePicker';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    grid: css`
      max-width: 100%;
      display: grid;
      grid-gap: ${theme.spacing.md};
      grid-template-columns: repeat(auto-fit, minmax(116px, 1fr));
    `,
  };
});
