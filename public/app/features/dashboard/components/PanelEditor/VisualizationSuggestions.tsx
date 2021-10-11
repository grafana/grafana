import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, VisualizationSuggestion } from '@grafana/data';
import { useStyles } from '@grafana/ui';

interface Props {
  suggestions: VisualizationSuggestion[];
}

export function VisualizationSuggestions({ suggestions }: Props) {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.wrapper}>
      {suggestions.map((suggestion) => (
        <div key={suggestion.name}>
          <div>Name: {suggestion.name}</div>
          <div>Plugin: {suggestion.pluginId}</div>
        </div>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      height: 100%;
    `,
  };
};
