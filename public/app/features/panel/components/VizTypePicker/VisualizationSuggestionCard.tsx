import { css, cx } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { type GrafanaTheme2, type PanelData, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Tooltip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { PanelRenderer } from '../PanelRenderer';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  data: PanelData;
  width: number;
  suggestion: PanelPluginVisualizationSuggestion;
  isSelected?: boolean;
}

export function VisualizationSuggestionCard({ data, suggestion, width, className, isSelected, ...restProps }: Props) {
  const styles = useStyles2(getStyles);
  const { innerStyles, outerStyles, renderWidth, renderHeight } = getPreviewDimensionsAndStyles(width);
  const cardOptions = suggestion.cardOptions ?? {};

  const commonButtonProps = {
    'aria-label': suggestion.name,
    className: cx(className, styles.vizBox, isSelected && styles.selected),
    'data-testid': selectors.components.VisualizationPreview.card(suggestion.name),
    style: outerStyles,
    ...restProps,
  } satisfies HTMLAttributes<HTMLDivElement> & { 'data-testid': string };

  let content: ReactNode;

  if (cardOptions.imgSrc) {
    content = (
      <div {...commonButtonProps} className={cx(commonButtonProps.className, styles.imgBox)}>
        <div className={styles.name}>{suggestion.name}</div>
        <img className={styles.img} src={cardOptions.imgSrc} alt={suggestion.name} />
      </div>
    );
  } else {
    let preview = suggestion;
    if (suggestion.cardOptions?.previewModifier) {
      preview = cloneDeep(suggestion);
      suggestion.cardOptions.previewModifier(preview);
    }

    const maxSeries = cardOptions.maxSeries;
    const maxRows = cardOptions.maxRows;
    let previewData = maxSeries ? { ...data, series: data.series.slice(0, maxSeries) } : data;

    if (maxRows && previewData.series.some((frame) => frame.length > maxRows)) {
      previewData = {
        ...previewData,
        series: previewData.series.map((frame) =>
          frame.length > maxRows
            ? {
                ...frame,
                length: maxRows,
                fields: frame.fields.map((field) => ({ ...field, values: field.values.slice(0, maxRows) })),
              }
            : frame
        ),
      };
    }

    content = (
      <div {...commonButtonProps}>
        {/* to use inert in React 18, we have to do this hacky object spread thing. https://stackoverflow.com/questions/72720469/error-when-using-inert-attribute-with-typescript */}
        <div style={innerStyles} className={styles.renderContainer} {...{ inert: '' }}>
          <PanelRenderer
            title=""
            data={previewData}
            pluginId={suggestion.pluginId}
            width={renderWidth}
            height={renderHeight}
            options={preview.options}
            fieldConfig={preview.fieldConfig}
          />
        </div>
      </div>
    );
  }

  return <Tooltip content={suggestion.description ?? suggestion.name}>{content}</Tooltip>;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    selectedSuggestion: css({
      filter: `blur(1px) ${theme.isDark ? 'brightness(0.5)' : 'opacity(0.3)'}`,
    }),
    vizBox: css({
      position: 'relative',
      background: 'none',
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      border: `1px solid ${theme.colors.border.medium}`,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background', 'border-color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      '&:hover': {
        background: theme.colors.background.secondary,
        borderColor: theme.colors.primary.border,
      },
    }),
    selected: css({
      borderColor: theme.colors.primary.border,
      background: theme.colors.background.secondary,
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
      '&& *': { scrollbarWidth: 'none' },
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
  const renderWidth = 350;
  const renderHeight = renderWidth * (1 / aspectRatio);

  // width is 0 on the first render (before useMeasure)
  if (width === 0) {
    return {
      renderWidth,
      renderHeight,
      outerStyles: { width: '100%', aspectRatio: `${aspectRatio}` },
      innerStyles: { display: 'none' },
    };
  }

  const showWidth = width;
  const showHeight = width * (1 / aspectRatio);
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
