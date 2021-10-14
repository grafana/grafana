import React, { useMemo } from 'react';
import { VizTypePickerPlugin } from './VizTypePickerPlugin';
import { EmptySearchResult, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, PanelData, PanelPluginMeta } from '@grafana/data';
import { css } from '@emotion/css';
import { filterPluginList, getAllPanelPluginMeta } from '../../state/util';
import { VizTypeChangeDetails } from './types';
import { VisualizationPreview } from './VisualizationPreview';
import { getAllSuggestions } from './getAllSuggestions';
import { useAsync } from 'react-use';

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

  const { value: suggestions } = useAsync(() => getAllSuggestions(data), [data]);

  if (filteredPluginTypes.length === 0) {
    return <EmptySearchResult>Could not find anything matching your query</EmptySearchResult>;
  }

  return (
    <div>
      {!searchQuery && Boolean(suggestions?.length) && (
        <>
          <div className={styles.heading}>Suggested</div>
          <div className={styles.suggestionsGrid}>
            {suggestions!.map((suggestion, index) => (
              <VisualizationPreview key={index} data={data!} suggestion={suggestion} onChange={onChange} />
            ))}
          </div>
        </>
      )}
      {!searchQuery && Boolean(suggestions?.length) && <div className={styles.heading}>All</div>}
      <div className={styles.typeGrid}>
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
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    typeGrid: css`
      max-width: 100%;
      display: grid;
      grid-gap: ${theme.spacing(0.5)};
    `,
    heading: css({
      ...theme.typography.h5,
      margin: theme.spacing(0, 0.5),
    }),
    suggestionsGrid: css({
      display: 'grid',
      gridGap: theme.spacing(0.5),
      gridTemplateColumns: 'repeat(auto-fill, 144px)',
      marginBottom: theme.spacing(1),
    }),
  };
};
