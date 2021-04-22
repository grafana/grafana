import { stylesFactory } from '../../themes';
import { GrafanaThemeV2 } from '@grafana/data';
import { css as cssCore } from '@emotion/react';
import { css } from '@emotion/css';

export const getStyles = stylesFactory((theme: GrafanaThemeV2, isHorizontal: boolean) => {
  const { spacing } = theme;
  const railColor = theme.colors.border.strong;
  const trackColor = theme.colors.primary.main;
  const handleColor = theme.colors.primary.main;
  const blueOpacity = theme.colors.primary.transparent;
  const hoverSyle = `box-shadow: 0px 0px 0px 6px ${blueOpacity}`;

  return {
    container: css`
      width: 100%;
      margin: ${isHorizontal ? 'none' : `${spacing(1, 3, 1, 1)}`};
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
        box-shadow: ${theme.shadows.z1};
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
      margin-left: ${theme.spacing(3)};
      width: 60px;
      input {
        text-align: center;
      }
    `,
    sliderInputFieldVertical: css`
      margin: 0 0 ${theme.spacing(3)} 0;
      order: 1;
    `,
  };
});
