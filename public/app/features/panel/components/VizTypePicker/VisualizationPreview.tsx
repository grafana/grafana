import React, { CSSProperties } from 'react';
import { GrafanaTheme2, PanelData, VisualizationSuggestion } from '@grafana/data';
import { PanelRenderer } from '../PanelRenderer';
import { css } from '@emotion/css';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { VizTypeChangeDetails } from './types';
import { cloneDeep } from 'lodash';

export interface Props {
  data: PanelData;
  suggestion: VisualizationSuggestion;
  onChange: (details: VizTypeChangeDetails) => void;
}

export function VisualizationPreview({ data, suggestion, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const { innerStyles, outerStyles, renderWidth, renderHeight } = getPreviewDimensionsAndStyles();
  // const [showLargePreview, setShowLargePreview] = useState<boolean>(false);

  const onClick = () => {
    onChange({
      pluginId: suggestion.pluginId,
      options: suggestion.options,
      fieldConfig: suggestion.fieldConfig,
    });
  };

  let preview = suggestion;
  if (suggestion.previewModifier) {
    preview = cloneDeep(suggestion);
    suggestion.previewModifier(preview);
  }

  return (
    <div style={outerStyles} className={styles.card} onClick={onClick}>
      <Tooltip content={suggestion.name}>
        <div style={innerStyles} className={styles.renderContainer}>
          <PanelRenderer
            title=""
            data={data}
            pluginId={suggestion.pluginId}
            width={renderWidth}
            height={renderHeight}
            options={preview.options}
            fieldConfig={preview.fieldConfig}
          />
          <div className={styles.hoverPane} />
        </div>
      </Tooltip>
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
      cursor: pointer;
      background: ${theme.colors.background.secondary};
      box-shadow: ${theme.shadows.z1};

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

interface PreviewDimensionsAndStyles {
  renderWidth: number;
  renderHeight: number;
  innerStyles: CSSProperties;
  outerStyles: CSSProperties;
}

function getPreviewDimensionsAndStyles(): PreviewDimensionsAndStyles {
  const aspectRatio = 1.44;
  const renderWidth = 300 * aspectRatio;
  const renderHeight = 300;
  const showWidth = 100 * aspectRatio;
  const showHeight = 100;
  const padding = 6;
  const widthFactor = (showWidth - padding * 2) / renderWidth;
  const heightFactor = (showHeight - padding * 2) / renderHeight;

  return {
    renderHeight,
    renderWidth,
    outerStyles: { width: showWidth, height: showHeight },
    innerStyles: {
      width: renderWidth,
      height: renderHeight,
      transform: `scale(${widthFactor}, ${heightFactor})`,
    },
  };
}
