import React, { FunctionComponent } from 'react';
import { Range, createSliderWithTooltip } from 'rc-slider';
import { css } from 'emotion';
import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes/ThemeContext';

export enum SliderOrientation {
  horizontal = 'horizontal',
  vertical = 'vertical',
}

export interface Props {
  min: number;
  max: number;
  orientation?: SliderOrientation;
  // Set current positions of handle(s). If only 1 value supplied, only 1 handle displayed.
  value?: number[];
  reverse?: boolean;
  formatTooltipResult?: (value: number) => number | string;
  onChange?: (values: number[]) => void;
}

const defaultProps = { orientation: SliderOrientation.horizontal };

const getStyles = stylesFactory((theme: GrafanaTheme, isHorizontal: boolean) => {
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
    container: container,
  };
});

export const Slider: FunctionComponent<Props> = ({
  min,
  max,
  onChange,
  orientation,
  reverse,
  formatTooltipResult,
  value,
}) => {
  const isHorizontal = orientation === SliderOrientation.horizontal;
  const theme = useTheme();
  const styles = getStyles(theme, isHorizontal);
  const RangeWithTooltip = createSliderWithTooltip(Range);
  return (
    <div className={styles.container}>
      <RangeWithTooltip
        tipProps={{ visible: true, placement: isHorizontal ? 'top' : 'right' }}
        min={min}
        max={max}
        defaultValue={value || [min, max]}
        tipFormatter={(value: number) => (formatTooltipResult ? formatTooltipResult(value) : value)}
        onChange={onChange}
        vertical={!isHorizontal}
        reverse={reverse}
      />
    </div>
  );
};

Slider.displayName = 'Slider';
Slider.defaultProps = defaultProps;
