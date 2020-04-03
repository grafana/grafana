import React, { useCallback, useMemo } from 'react';

import config from 'app/core/config';
import VizTypePickerPlugin from './VizTypePickerPlugin';
import { EmptySearchResult, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, PanelPluginMeta } from '@grafana/data';
import { css } from 'emotion';

export interface Props {
  current: PanelPluginMeta;
  onTypeChange: (newType: PanelPluginMeta) => void;
  searchQuery: string;
  onClose: () => void;
}

export const VizTypePicker: React.FC<Props> = ({ searchQuery, onTypeChange, current }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const pluginsList: PanelPluginMeta[] = useMemo(() => {
    const allPanels = config.panels;

    return Object.keys(allPanels)
      .filter(key => allPanels[key]['hideFromList'] === false)
      .map(key => allPanels[key])
      .sort((a: PanelPluginMeta, b: PanelPluginMeta) => a.sort - b.sort);
  }, []);

  const renderVizPlugin = (plugin: PanelPluginMeta, index: number) => {
    const isCurrent = plugin.id === current.id;
    const filteredPluginList = getFilteredPluginList();

    const matchesQuery = filteredPluginList.indexOf(plugin) > -1;
    return (
      <VizTypePickerPlugin
        disabled={!matchesQuery}
        key={plugin.id}
        isCurrent={isCurrent}
        plugin={plugin}
        onClick={() => onTypeChange(plugin)}
      />
    );
  };

  const getFilteredPluginList = useCallback((): PanelPluginMeta[] => {
    const regex = new RegExp(searchQuery, 'i');
    return pluginsList.filter(item => {
      return regex.test(item.name);
    });
  }, [searchQuery]);

  const filteredPluginList = getFilteredPluginList();
  const hasResults = filteredPluginList.length > 0;
  const renderList = filteredPluginList.concat(pluginsList.filter(p => filteredPluginList.indexOf(p) === -1));

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        {hasResults ? (
          renderList.map((plugin, index) => renderVizPlugin(plugin, index))
        ) : (
          <EmptySearchResult>Could not find anything matching your query</EmptySearchResult>
        )}
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      padding-right: ${theme.spacing.md};
    `,
    grid: css`
      max-width: 100%;
      display: grid;
      grid-gap: ${theme.spacing.md};
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
    `,
  };
});
