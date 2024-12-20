import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { EmptySearchResult, useStyles2 } from '@grafana/ui';

import { filterPluginList, getAllPanelPluginMeta } from '../../state/util';

import { VizTypePickerPlugin } from './VizTypePickerPlugin';
import { VizTypeChangeDetails } from './types';

export interface Props {
  pluginId: string;
  searchQuery: string;
  onChange: (options: VizTypeChangeDetails) => void;
  trackSearch?: (q: string, count: number) => void;
}

export function VizTypePicker({ pluginId, searchQuery, onChange, trackSearch }: Props) {
  const styles = useStyles2(getStyles);
  const pluginsList = useMemo(getAllPanelPluginMeta, []);

  const filteredPluginTypes = useMemo(() => {
    const result = filterPluginList(pluginsList, searchQuery, pluginId);
    if (trackSearch) {
      trackSearch(searchQuery, result.length);
    }
    return result;
  }, [pluginsList, searchQuery, pluginId, trackSearch]);

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
