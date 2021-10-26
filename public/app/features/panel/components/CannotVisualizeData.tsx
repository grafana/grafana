import React from 'react';
import { CoreApp, GrafanaTheme2, PanelData, VisualizationSuggestion } from '@grafana/data';
import { usePanelContext, useStyles2 } from '@grafana/ui';
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
  const context = usePanelContext();

  return (
    <div className={styles.wrapper}>
      <div className={styles.message}>{message}</div>
      {context.app === CoreApp.PanelEditor && suggestions && (
        <div className={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <VisualizationPreview
              key={index}
              data={data!}
              suggestion={suggestion}
              showTitle={true}
              onChange={() => {}}
              width={200}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      width: '100%',
    }),
    message: css({
      textAlign: 'center',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.lg,
      width: '100%',
    }),
    suggestionsHeading: css({
      textAlign: 'center',
      marginTop: theme.spacing(2),
      color: theme.colors.text.secondary,
      width: '100%',
    }),
    suggestions: css({
      marginTop: theme.spacing(2),
      display: 'flex',
    }),
  };
};
