import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2, PanelData, PanelPluginMeta } from '@grafana/data';
import { EmptySearchResult, useStyles2 } from '@grafana/ui';

import { filterPluginList, getAllPanelPluginMeta } from '../../state/util';

import { VizTypePickerPlugin } from './VizTypePickerPlugin';
import { VizTypeChangeDetails } from './types';

export interface Props {
  current: PanelPluginMeta;
  data?: PanelData;
  onChange: (options: VizTypeChangeDetails) => void;
  searchQuery: string;
  onClose: () => void;
}

export function VizTypePicker({ searchQuery, onChange, current, data }: Props) {
  const styles = useStyles2(getStyles);
  const pluginsList: PanelPluginMeta[] = useMemo(() => {
    return getAllPanelPluginMeta();
  }, []);

  const filteredPluginTypes = useMemo((): PanelPluginMeta[] => {
    return filterPluginList(pluginsList, searchQuery, current);
  }, [current, pluginsList, searchQuery]);

  if (filteredPluginTypes.length === 0) {
    return <EmptySearchResult>Could not find anything matching your query</EmptySearchResult>;
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
