import React from 'react';
import { GrafanaTheme2, PanelData, VisualizationSuggestion } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { VisualizationPreview } from './VizTypePicker/VisualizationPreview';

interface Props {
  message?: string;
  panelId: number;
  data: PanelData;
  suggestions?: VisualizationSuggestion[];
}

export function CannotVisualizeData({ data, message, suggestions }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.message}>{message}</div>
      {suggestions && (
        <div className={styles.list}>
          {suggestions.map((suggestion, index) => (
            <VisualizationPreview key={index} data={data!} suggestion={suggestion} onChange={() => {}} width={150} />
          ))}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: flex;
      align-items: center;
      height: 100%;
      width: 100%;
    `,
    message: css`
      text-align: center;
      color: $text-muted;
      font-size: $font-size-lg;
      width: 100%;
    `,
    list: css``,
  };
};
