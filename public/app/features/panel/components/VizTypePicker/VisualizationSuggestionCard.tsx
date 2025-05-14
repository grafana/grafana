import { css, cx } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { CSSProperties } from 'react';

import { GrafanaTheme2, PanelData, VisualizationSuggestion } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { PanelRenderer } from '../PanelRenderer';

import { VizTypeChangeDetails } from './types';

export interface Props {
  data: PanelData;
  width: number;
  suggestion: VisualizationSuggestion;
  onChange: (details: VizTypeChangeDetails) => void;
}

export function VisualizationSuggestionCard({ data, suggestion, onChange, width }: Props) {
  const styles = useStyles2(getStyles);
  const { innerStyles, outerStyles, renderWidth, renderHeight } = getPreviewDimensionsAndStyles(width);
  const cardOptions = suggestion.cardOptions ?? {};

  const commonButtonProps = {
    'aria-label': suggestion.name,
    className: styles.vizBox,
    'data-testid': selectors.components.VisualizationPreview.card(suggestion.name),
    style: outerStyles,
    onClick: () => {
      onChange({
        pluginId: suggestion.pluginId,
        options: suggestion.options,
        fieldConfig: suggestion.fieldConfig,
      });
    },
  };

  if (cardOptions.imgSrc) {
    return (
      <Tooltip content={suggestion.description ?? suggestion.name}>
        <button {...commonButtonProps} className={cx(styles.vizBox, styles.imgBox)}>
          <div className={styles.name}>{suggestion.name}</div>
          <img className={styles.img} src={cardOptions.imgSrc} alt={suggestion.name} />
        </button>
      </Tooltip>
    );
  }

  let preview = suggestion;
  if (suggestion.cardOptions?.previewModifier) {
    preview = cloneDeep(suggestion);
    suggestion.cardOptions.previewModifier(preview);
  }

  return (
    <button {...commonButtonProps}>
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
    </button>
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
    vizBox: css({
      position: 'relative',
      background: 'none',
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      border: `1px solid ${theme.colors.border.medium}`,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: theme.colors.background.secondary,
      },
    }),
    imgBox: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',

      justifySelf: 'center',
      color: theme.colors.text.primary,
      width: '100%',

      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
    }),
    name: css({
      paddingBottom: theme.spacing(0.5),
      marginTop: theme.spacing(-1),
      fontSize: theme.typography.bodySmall.fontSize,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
      textOverflow: 'ellipsis',
    }),
    img: css({
      maxWidth: theme.spacing(8),
      maxHeight: theme.spacing(8),
    }),
    renderContainer: css({
      position: 'absolute',
      transformOrigin: 'left top',
      top: '6px',
      left: '6px',
    }),
  };
};

interface PreviewDimensionsAndStyles {
  renderWidth: number;
  renderHeight: number;
  innerStyles: CSSProperties;
  outerStyles: CSSProperties;
}

function getPreviewDimensionsAndStyles(width: number): PreviewDimensionsAndStyles {
  const aspectRatio = 16 / 10;
  const showWidth = width;
  const showHeight = width * (1 / aspectRatio);
  const renderWidth = 350;
  const renderHeight = renderWidth * (1 / aspectRatio);

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
