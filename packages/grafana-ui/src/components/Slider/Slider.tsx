import React, { FunctionComponent } from 'react';
import { Range, createSliderWithTooltip } from 'rc-slider';
import { cx, css } from 'emotion';
import { Global, css as cssCore } from '@emotion/core';
import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes/ThemeContext';
import { Orientation } from '../../types/orientation';

export interface Props {
  min: number;
  max: number;
  orientation?: Orientation;
  /** Set current positions of handle(s). If only 1 value supplied, only 1 handle displayed. */
  value?: number[];
  reverse?: boolean;
  step?: number;
  tooltipAlwaysVisible?: boolean;
  formatTooltipResult?: (value: number) => number | string;
  onChange?: (values: number[]) => void;
  onAfterChange?: (values: number[]) => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme, isHorizontal: boolean) => {
  const trackColor = theme.isLight ? theme.palette.gray5 : theme.palette.dark6;
  const container = isHorizontal
    ? css`
        width: 100%;
        margin: ${theme.spacing.lg} ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm};
      `
    : css`
        height: 100%;
        margin: ${theme.spacing.sm} ${theme.spacing.lg} ${theme.spacing.sm} ${theme.spacing.sm};
      `;

  return {
    container,
    slider: css`
      .rc-slider-vertical .rc-slider-handle {
        margin-top: -10px;
      }
      .rc-slider-handle {
        border: solid 2px ${theme.palette.blue77};
        background-color: ${theme.palette.blue77};
      }
      .rc-slider-handle:hover {
        border-color: ${theme.palette.blue77};
      }
      .rc-slider-handle:focus {
        border-color: ${theme.palette.blue77};
        box-shadow: none;
      }
      .rc-slider-handle:active {
        border-color: ${theme.palette.blue77};
        box-shadow: none;
      }
      .rc-slider-handle-click-focused:focus {
        border-color: ${theme.palette.blue77};
      }
      .rc-slider-dot-active {
        border-color: ${theme.palette.blue77};
      }
      .rc-slider-track {
        background-color: ${theme.palette.blue77};
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
  };
});

export const Slider: FunctionComponent<Props> = ({
  min,
  max,
  onChange,
  onAfterChange,
  orientation = 'horizontal',
  reverse,
  step,
  formatTooltipResult,
  value,
  tooltipAlwaysVisible = true,
}) => {
  const isHorizontal = orientation === 'horizontal';
  const theme = useTheme();
  const styles = getStyles(theme, isHorizontal);
  const RangeWithTooltip = createSliderWithTooltip(Range);
  return (
    <div className={cx(styles.container, styles.slider)}>
      {/** Slider tooltip's parent component is body and therefore we need Global component to do css overrides for it. */}
      <Global styles={styles.tooltip} />
      <RangeWithTooltip
        tipProps={{
          visible: tooltipAlwaysVisible,
          placement: isHorizontal ? 'top' : 'right',
        }}
        min={min}
        max={max}
        step={step}
        defaultValue={value || [min, max]}
        tipFormatter={(value: number) => (formatTooltipResult ? formatTooltipResult(value) : value)}
        onChange={onChange}
        onAfterChange={onAfterChange}
        vertical={!isHorizontal}
        reverse={reverse}
      />
    </div>
  );
};

Slider.displayName = 'Slider';
