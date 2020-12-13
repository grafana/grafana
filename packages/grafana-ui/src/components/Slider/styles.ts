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
  const trackColor = theme.isLight ? theme.palette.gray5 : theme.palette.dark6;
  const blueColor = theme.isLight ? theme.palette.blue80 : theme.palette.blue77;
  const container = isHorizontal
    ? css`
        width: 100%;
      `
    : css`
        height: 100%;
        margin: ${theme.spacing.sm} ${theme.spacing.lg} ${theme.spacing.sm} ${theme.spacing.sm};
      `;
  const blueOpacity = tinycolor(blueColor)
    .setAlpha(0.2)
    .toString();

  return {
    container,
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
        background-color: ${blueColor};
        cursor: pointer;
      }
      .rc-slider-handle:hover {
        box-shadow: 0px 0px 0px 6px ${blueOpacity};
      }
      .rc-slider-handle:focus {
        border: none;
        box-shadow: 0px 0px 0px 6px ${blueOpacity};
      }
      .rc-slider-handle:active {
        border: none;
        box-shadow: 0px 0px 0px 6px ${blueOpacity};
      }
      .rc-slider-handle-click-focused:focus {
        border: none;
        box-shadow: 0px 0px 0px 6px ${blueOpacity};
      }
      .rc-slider-dot-active {
        border: none;
        box-shadow: 0px 0px 0px 6px ${blueOpacity};
      }
      .rc-slider-track {
        background-color: ${blueColor};
      }
      .rc-slider-rail {
        background-color: ${trackColor};
        border: 1px solid ${trackColor};
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
      display: flex;
      flex-grow: 0;
      flex-basis: 50px;
      margin-left: ${theme.spacing.lg};
      height: ${theme.spacing.formInputHeight}px;
      text-align: center;
      border-radius: ${theme.border.radius.sm};
      border: 1px solid ${theme.colors.formInputBorder};
      ${getFocusStyle(theme)};
    `,
    sliderInputFieldVertical: css`
      margin: 0 0 ${theme.spacing.lg} 0;
      order: 1;
    `,
  };
});
