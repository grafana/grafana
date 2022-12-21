import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, PanelData, PanelPluginMeta, PanelModel, VisualizationSuggestion } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getAllSuggestions } from '../../state/getAllSuggestions';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';
import { VizTypeChangeDetails } from './types';

export interface Props {
  current: PanelPluginMeta;
  data?: PanelData;
  panel?: PanelModel;
  onChange: (options: VizTypeChangeDetails) => void;
  searchQuery: string;
  onClose: () => void;
}

export function VisualizationSuggestions({ onChange, data, panel, searchQuery }: Props) {
  const styles = useStyles2(getStyles);
  const { value: suggestions } = useAsync(() => getAllSuggestions(data, panel), [data, panel]);
  const filteredSuggestions = filterSuggestionsBySearch(searchQuery, suggestions);

  return (
    <AutoSizer disableHeight style={{ width: '100%', height: '100%' }}>
      {({ width }) => {
        if (!width) {
          return null;
        }

        const columnCount = Math.floor(width / 170);
        const spaceBetween = 8 * (columnCount! - 1);
        const previewWidth = (width - spaceBetween) / columnCount!;

        return (
          <div>
            <div className={styles.filterRow}>
              <div className={styles.infoText}>Based on current data</div>
            </div>
            <div className={styles.grid} style={{ gridTemplateColumns: `repeat(auto-fill, ${previewWidth - 1}px)` }}>
              {filteredSuggestions.map((suggestion, index) => (
                <VisualizationSuggestionCard
                  key={index}
                  data={data!}
                  suggestion={suggestion}
                  onChange={onChange}
                  width={previewWidth}
                />
              ))}
              {searchQuery && filteredSuggestions.length === 0 && (
                <div className={styles.infoText}>No results matched your query</div>
              )}
            </div>
          </div>
        );
      }}
    </AutoSizer>
  );
}

function filterSuggestionsBySearch(
  searchQuery: string,
  suggestions?: VisualizationSuggestion[]
): VisualizationSuggestion[] {
  if (!searchQuery || !suggestions) {
    return suggestions || [];
  }

  const regex = new RegExp(searchQuery, 'i');

  return suggestions.filter((s) => regex.test(s.name) || regex.test(s.pluginId));
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      ...theme.typography.h5,
      margin: theme.spacing(0, 0.5, 1),
    }),
    filterRow: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingBottom: '8px',
    }),
    infoText: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
    grid: css({
      display: 'grid',
      gridGap: theme.spacing(1),
      gridTemplateColumns: 'repeat(auto-fill, 144px)',
      marginBottom: theme.spacing(1),
      justifyContent: 'space-evenly',
    }),
  };
};
