import { css, cx } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { GrafanaTheme2, PanelData, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { PanelRenderer } from '../PanelRenderer';

export interface Props extends HTMLAttributes<HTMLButtonElement> {
  data: PanelData;
  width: number;
  suggestion: PanelPluginVisualizationSuggestion;
  isSelected?: boolean;
}

export function VisualizationSuggestionCard({
  data,
  suggestion,
  width,
  isSelected = false,
  className,
  ...restProps
}: Props) {
  const styles = useStyles2(getStyles);
  const { innerStyles, outerStyles, renderWidth, renderHeight } = getPreviewDimensionsAndStyles(width);
  const cardOptions = suggestion.cardOptions ?? {};
  const isNewVizSuggestionsEnabled = config.featureToggles.newVizSuggestions;

  const commonButtonProps = {
    'aria-label': suggestion.name,
    className: cx(
      className,
      styles.vizBox,
      config.featureToggles.newVizSuggestions && isSelected && styles.selectedBox
    ),
    'data-testid': selectors.components.VisualizationPreview.card(suggestion.name),
    style: outerStyles,
    tabIndex: -1, // selection is handled by parent container
    ...restProps,
  } satisfies HTMLAttributes<HTMLButtonElement> & { 'data-testid': string };

  let content: ReactNode;

  if (cardOptions.imgSrc) {
    content = (
      <button {...commonButtonProps} className={cx(commonButtonProps.className, styles.imgBox)}>
        <div className={styles.name}>{suggestion.name}</div>
        <img className={styles.img} src={cardOptions.imgSrc} alt={suggestion.name} />
      </button>
    );
  } else {
    let preview = suggestion;
    if (suggestion.cardOptions?.previewModifier) {
      preview = cloneDeep(suggestion);
      suggestion.cardOptions.previewModifier(preview);
    }

    // const eventHandlers = ([
    //   'onClick',
    //   'onDoubleClick',
    //   'onMouseMove',
    //   'onMouseEnter',
    //   'onMouseLeave',
    //   'onFocus',
    //   'onBlur',
    // ] as const).reduce((handlers: HTMLAttributes<HTMLDivElement>, eventName) => {
    //   handlers[eventName] = (ev) => ev.stopPropagation();
    //   return handlers;
    // }, {});

    content = (
      <button {...commonButtonProps}>
        {/* to use inert in React 18, we have to do this hacky object spread thing. https://stackoverflow.com/questions/72720469/error-when-using-inert-attribute-with-typescript */}
        <div
          style={innerStyles}
          className={cx(styles.renderContainer, isSelected && styles.selectedSuggestion)}
          {...{ inert: '' }}
        >
          <PanelRenderer
            title=""
            data={data}
            pluginId={suggestion.pluginId}
            width={renderWidth}
            height={renderHeight}
            options={preview.options}
            fieldConfig={preview.fieldConfig}
          />
        </div>
      </button>
    );
  }

  if (!isNewVizSuggestionsEnabled) {
    return <Tooltip content={suggestion.description ?? suggestion.name}>{content}</Tooltip>;
  }

  return content;
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
    selectedBox: css({
      border: `1px solid ${theme.colors.primary.border}`,
      background: theme.colors.action.selected,
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
