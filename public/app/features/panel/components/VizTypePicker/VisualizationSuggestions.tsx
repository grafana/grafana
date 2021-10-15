import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, PanelData, PanelPluginMeta } from '@grafana/data';
import { css } from '@emotion/css';
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

export function VisualizationSuggestions({ onChange, data }: Props) {
  const styles = useStyles2(getStyles);

  const { value: suggestions } = useAsync(() => getAllSuggestions(data), [data]);

  return (
    <div className={styles.grid}>
      {suggestions &&
        suggestions.map((suggestion, index) => (
          <VisualizationPreview key={index} data={data!} suggestion={suggestion} onChange={onChange} />
        ))}
    </div>
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
    }),
  };
};
