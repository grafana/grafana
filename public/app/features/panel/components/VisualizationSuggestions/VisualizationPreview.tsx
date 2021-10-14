import React, { CSSProperties } from 'react';
import { GrafanaTheme2, PanelData, VisualizationSuggestion } from '@grafana/data';
import { PanelRenderer } from '../PanelRenderer';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  data: PanelData;
  suggestion: VisualizationSuggestion;
}

export function VisualizationPreview({ data, suggestion }: Props) {
  const styles = useStyles2(getStyles);
  const aspectRatio = 1.33;

  const renderWidth = 300 * aspectRatio;
  const renderHeight = 300;
  const showWidth = 100 * aspectRatio;
  const showHeight = 100;
  const padding = 6;
  const widthFactor = (showWidth - padding * 2) / renderWidth;
  const heightFactor = (showHeight - padding * 2) / renderHeight;

  const renderContainerStyles: CSSProperties = {
    width: renderWidth,
    height: renderHeight,
    transform: `scale(${widthFactor}, ${heightFactor})`,
  };

  return (
    <div style={{ width: showWidth, height: showHeight }} className={styles.card}>
      <div style={renderContainerStyles} className={styles.renderContainer}>
        <PanelRenderer
          title=""
          data={data}
          pluginId={suggestion.pluginId}
          width={renderWidth}
          height={renderHeight}
          options={suggestion.options}
          fieldConfig={suggestion.fieldConfig}
        />
        <div className={styles.hoverPane} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    hoverPane: css({
      position: 'absolute',
      top: 0,
      right: 0,
      left: 0,
      borderRadius: theme.spacing(2),
      bottom: 0,
    }),
    card: css`
      position: relative;
      border-radius: ${theme.shape.borderRadius(1)};
      border: 2px solid ${theme.colors.border.medium};
      margin: ${theme.spacing(1)};

      transition: ${theme.transitions.create(['background'], {
        duration: theme.transitions.duration.short,
      })};

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
      }
    `,
    renderContainer: css`
      position: absolute;
      transform-origin: left top;
      top: 6px;
      left: 6px;
    `,
  };
};
