import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { EmptySearchResult, useStyles2 } from '@grafana/ui';

import { filterPluginList, getAllPanelPluginMeta, getVizPluginMeta, getWidgetPluginMeta } from '../../state/util';

import { VizTypePickerPlugin } from './VizTypePickerPlugin';
import { VizTypeChangeDetails } from './types';

export interface Props {
  pluginId: string;
  searchQuery: string;
  onChange: (options: VizTypeChangeDetails) => void;
  isWidget?: boolean;
}

export function VizTypePicker({ pluginId, searchQuery, onChange, isWidget = false }: Props) {
  const styles = useStyles2(getStyles);
  const pluginsList = useMemo(() => {
    if (config.featureToggles.vizAndWidgetSplit) {
      return isWidget ? getWidgetPluginMeta() : getVizPluginMeta();
    }
    return getAllPanelPluginMeta();
  }, [isWidget]);

  const filteredPluginTypes = useMemo(
    () => filterPluginList(pluginsList, searchQuery, pluginId),
    [pluginsList, searchQuery, pluginId]
  );

  if (filteredPluginTypes.length === 0) {
    return <EmptySearchResult>Could not find anything matching your query</EmptySearchResult>;
  }

  return (
    <div className={styles.grid}>
      {filteredPluginTypes.map((plugin) => (
        <VizTypePickerPlugin
          disabled={false}
          key={plugin.id}
          isCurrent={plugin.id === pluginId}
          plugin={plugin}
          onClick={(e) =>
            onChange({
              pluginId: plugin.id,
              withModKey: e.metaKey || e.ctrlKey || e.altKey,
            })
          }
        />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    maxWidth: '100%',
    display: 'grid',
    gridGap: theme.spacing(0.5),
  }),
  heading: css({
    ...theme.typography.h5,
    margin: theme.spacing(0, 0.5, 1),
  }),
});
