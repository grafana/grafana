import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { focusCss } from '../../themes/mixins';
import { css as cssCore } from '@emotion/core';
import { css } from 'emotion';
import tinycolor from 'tinycolor2';

export const getFocusStyle = (theme: GrafanaTheme) => css`
  &:focus {
    ${focusCss(theme)}
  }
`;

export const getStyles = stylesFactory((theme: GrafanaTheme, isHorizontal: boolean) => {
  const { spacing, palette } = theme;
  const railColor = theme.isLight ? palette.gray5 : palette.dark6;
  const trackColor = theme.isLight ? palette.blue85 : palette.blue77;
  const handleColor = theme.isLight ? palette.blue85 : palette.blue80;
  const blueOpacity = tinycolor(handleColor).setAlpha(0.2).toString();
  const hoverSyle = `box-shadow: 0px 0px 0px 6px ${blueOpacity}`;

  return {
    container: css`
      width: 100%;
      margin: ${isHorizontal ? 'none' : `${spacing.sm} ${spacing.lg} ${spacing.sm} ${spacing.sm}`};
      height: ${isHorizontal ? 'auto' : '100%'};
    `,
    slider: css`
      .rc-slider {
        display: flex;
        flex-grow: 1;
        margin-left: 7px; // half the size of the handle to align handle to the left on 0 value
      }
      .rc-slider-vertical .rc-slider-handle {
        margin-top: -10px;
      }
      .rc-slider-handle {
        border: none;
        background-color: ${handleColor};
        cursor: pointer;
      }
      .rc-slider-handle:hover,
      .rc-slider-handle:active,
      .rc-slider-handle:focus,
      .rc-slider-handle-click-focused:focus,
      .rc-slider-dot-active {
        ${hoverSyle};
      }
      .rc-slider-track {
        background-color: ${trackColor};
      }
      .rc-slider-rail {
        background-color: ${railColor};
        border: 1px solid ${railColor};
        cursor: pointer;
      }
    `,
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
          color: ${theme.colors.text};
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
    sliderInput: css`
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 100%;
    `,
    sliderInputVertical: css`
      flex-direction: column;
      height: 100%;

      .rc-slider {
        margin: 0;
        order: 2;
      }
    `,
    sliderInputField: css`
      margin-left: ${theme.spacing.lg};
      width: 60px;
      input {
        text-align: center;
      }
    `,
    sliderInputFieldVertical: css`
      margin: 0 0 ${theme.spacing.lg} 0;
      order: 1;
    `,
  };
});
