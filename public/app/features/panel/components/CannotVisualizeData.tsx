import React from 'react';
import { GrafanaTheme2, VisualizationSuggestion } from '@grafana/data';
import { useStyles2 } from '../../../../../packages/grafana-ui/src';
import { css } from '@emotion/css';

interface Props {
  message: string;
  suggestions?: VisualizationSuggestion[];
}

export function CannotVisualizeData({ message, suggestions }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.message}>{message}</div>
      {
        //   suggestions && (
        //   <div className={styles.suggestions}>
        //     {suggestions.map((suggestion, index) => (
        //       <VisualizationPreview
        //         key={index}
        //         data={data!}
        //         suggestion={suggestion}
        //         onChange={onChange}
        //         width={150}
        //       />
        //     ))}
        //   </div>
        // )
      }
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
  };
};
