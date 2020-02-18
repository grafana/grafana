import React, { FunctionComponent } from 'react';
import { Range, createSliderWithTooltip } from 'rc-slider';
import { css } from 'emotion';
import { stylesFactory } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes/ThemeContext';

export interface Props {
  min: number;
  max: number;
  orientation: 'horizontal' | 'vertical';
  reverse?: boolean;
  lengthOfSlider?: number;
  formatTooltipResult?: (value: number) => number | string;
  onChange?: (values: number[]) => void;
}

const getStyles = stylesFactory(
  (theme: GrafanaTheme, orientation: 'horizontal' | 'vertical', lengthOfSlider: number | undefined) => {
    const length = lengthOfSlider || 200;
    const container =
      orientation === 'horizontal'
        ? css`
            width: ${length}px;
            margin: ${theme.spacing.lg};
          `
        : css`
            height: ${length}px;
            margin: ${theme.spacing.lg};
          `;
    return {
      container: container,
    };
  }
);

export const Slider: FunctionComponent<Props> = ({
  min,
  max,
  onChange,
  orientation,
  lengthOfSlider,
  reverse,
  formatTooltipResult,
}) => {
  const theme = useTheme();
  const isHorizontal = orientation === 'horizontal';
  const styles = getStyles(theme, orientation, lengthOfSlider);
  const RangeWithTooltip = createSliderWithTooltip(Range);
  return (
    <div className={styles.container}>
      <RangeWithTooltip
        tipProps={{ visible: true, placement: isHorizontal ? 'top' : 'right' }}
        min={min}
        max={max}
        defaultValue={[min, max]}
        tipFormatter={(value: number) => (formatTooltipResult ? formatTooltipResult(value) : value)}
        onChange={onChange}
        vertical={!isHorizontal}
        reverse={reverse}
      />
    </div>
  );
};

Slider.displayName = 'Slider';
