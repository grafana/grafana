import { css } from '@emotion/css';
import { css as cssCore } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory } from '../../themes';

export const getStyles = stylesFactory((theme: GrafanaTheme2, isHorizontal: boolean, hasMarks = false) => {
  const { spacing } = theme;
  const railColor = theme.colors.border.strong;
  const trackColor = theme.colors.primary.main;
  const handleColor = theme.colors.primary.main;
  const blueOpacity = theme.colors.primary.transparent;
  const hoverStyle = `box-shadow: 0px 0px 0px 6px ${blueOpacity}`;

  return {
    container: css({
      width: '100%',
      margin: isHorizontal ? 'inherit' : spacing(1, 3, 1, 1),
      paddingBottom: isHorizontal && hasMarks ? theme.spacing(1) : 'inherit',
      height: isHorizontal ? 'auto' : '100%',
    }),
    slider: css({
      '.rc-slider': {
        display: 'flex',
        flexGrow: 1,
        marginLeft: '7px', // half the size of the handle to align handle to the left on 0 value
      },
      '.rc-slider-mark': {
        top: theme.spacing(1.75),
      },
      '.rc-slider-mark-text': {
        color: theme.colors.text.disabled,
        fontSize: theme.typography.bodySmall.fontSize,
      },
      '.rc-slider-mark-text-active': {
        color: theme.colors.text.primary,
      },
      '.rc-slider-handle': {
        border: 'none',
        backgroundColor: handleColor,
        boxShadow: theme.shadows.z1,
        cursor: 'pointer',
        opacity: 1,
      },

      '.rc-slider-handle:hover, .rc-slider-handle:active, .rc-slider-handle-click-focused:focus': hoverStyle,

      // The triple class names is needed because that's the specificity used in the source css :(
      '.rc-slider-handle-dragging.rc-slider-handle-dragging.rc-slider-handle-dragging, .rc-slider-handle:focus-visible':
        {
          boxShadow: `0 0 0 5px ${theme.colors.text.primary}`,
        },

      '.rc-slider-dot, .rc-slider-dot-active': {
        backgroundColor: theme.colors.text.primary,
        borderColor: theme.colors.text.primary,
      },

      '.rc-slider-track': {
        backgroundColor: trackColor,
      },
      '.rc-slider-rail': {
        backgroundColor: railColor,
        cursor: 'pointer',
      },
    }),
    /** Global component from @emotion/core doesn't accept computed classname string returned from css from emotion.
     * It accepts object containing the computed name and flattened styles returned from css from @emotion/core
     * */
    tooltip: cssCore`
      body {
        .rc-slider-tooltip {
          cursor: grab;
          user-select: none;
          z-index: ${theme.zIndex.tooltip};
        }

        .rc-slider-tooltip-inner {
          color: ${theme.colors.text.primary};
          background-color: transparent !important;
          border-radius: 0;
          box-shadow: none;
        }

        .rc-slider-tooltip-placement-top .rc-slider-tooltip-arrow {
          display: none;
        }

        .rc-slider-tooltip-placement-top {
          padding: 0;
        }
      }
    `,
    sliderInput: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    }),
    sliderInputVertical: css({
      flexDirection: 'column',
      height: '100%',

      '.rc-slider': {
        margin: 0,
        order: 2,
      },
    }),
    sliderInputField: css({
      marginLeft: theme.spacing(3),
      width: '60px',
      input: {
        textAlign: 'center',
      },
    }),
    sliderInputFieldVertical: css({
      margin: `0 0 ${theme.spacing(3)} 0`,
      order: 1,
    }),
  };
});
