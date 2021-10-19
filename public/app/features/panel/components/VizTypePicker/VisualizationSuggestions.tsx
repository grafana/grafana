import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, PanelData, PanelPluginMeta, PanelModel } from '@grafana/data';
import { css } from '@emotion/css';
import { VizTypeChangeDetails } from './types';
import { VisualizationPreview } from './VisualizationPreview';
import { getAllSuggestions } from './getAllSuggestions';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

export interface Props {
  current: PanelPluginMeta;
  data?: PanelData;
  panel?: PanelModel;
  onChange: (options: VizTypeChangeDetails) => void;
  searchQuery: string;
  onClose: () => void;
}

export function VisualizationSuggestions({ onChange, data, panel }: Props) {
  const styles = useStyles2(getStyles);
  const { value: suggestions } = useAsync(() => getAllSuggestions(data, panel), [data, panel]);

  return (
    <AutoSizer disableHeight style={{ width: '100%', height: '100%' }}>
      {({ width }) => {
        if (!width) {
          return null;
        }

        const previewWidth = (width - 4) / 2;

        return (
          <div className={styles.grid} style={{ gridTemplateColumns: `repeat(auto-fill, ${previewWidth - 1}px)` }}>
            {suggestions &&
              suggestions.map((suggestion, index) => (
                <VisualizationPreview
                  key={index}
                  data={data!}
                  suggestion={suggestion}
                  onChange={onChange}
                  width={previewWidth}
                />
              ))}
          </div>
        );
      }}
    </AutoSizer>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      ...theme.typography.h5,
      margin: theme.spacing(0, 0.5, 1),
    }),
    grid: css({
      display: 'grid',
      gridGap: theme.spacing(0.5),
      gridTemplateColumns: 'repeat(auto-fill, 144px)',
      marginBottom: theme.spacing(1),
      justifyContent: 'space-evenly',
    }),
  };
};
