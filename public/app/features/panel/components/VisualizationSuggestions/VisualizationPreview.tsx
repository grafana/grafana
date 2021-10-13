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

  const fullWidth = 400;
  const renderWidth = 300 * aspectRatio;
  const renderHeight = 300;
  const showWidth = 90 * aspectRatio;
  const showHeight = 90;
  const widthFactor = showWidth / renderWidth;
  const heightFactor = showHeight / renderHeight;

  const style: CSSProperties = {
    width: renderWidth,
    height: renderHeight,
    transform: `scale(${widthFactor}, ${heightFactor})`,
  };

  return (
    <div style={{ position: 'relative', width: showWidth, height: showHeight, marginRight: '8px' }}>
      <div style={style} className={styles.card}>
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
      ':hover': {
        background: 'rgba(255,255,255,0.1)',
      },
    }),
    card: css`
      position: absolute;
      transform-origin: left top;
      display: flex;
      flex-shrink: 0;
      cursor: pointer;
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
      box-shadow: ${theme.shadows.z1};
      border: 1px solid ${theme.colors.background.secondary};
      align-items: center;
      padding: 8px;
      position: relative;
      overflow: hidden;
      transition: ${theme.transitions.create(['background'], {
        duration: theme.transitions.duration.short,
      })};

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
      }
    `,
  };
};
