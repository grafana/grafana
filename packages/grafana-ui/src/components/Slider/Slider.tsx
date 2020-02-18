import React, { FunctionComponent } from 'react';
import { Range, createSliderWithTooltip } from 'rc-slider';
import { css } from 'emotion';
import { stylesFactory, withTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { Themeable } from '../../types';

export interface Props extends Themeable {
  min: number;
  max: number;
  orientation: 'horizontal' | 'vertical';
  reverse?: boolean;
  size?: string;
  formatTooltipResult?: (value: any) => number | string;
  onChange?: (value: any) => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme, orientation: 'horizontal' | 'vertical', size: string) => {
  const container =
    orientation === 'horizontal'
      ? css`
          width: ${size};
          margin: 20px;
        `
      : css`
          height: ${size};
          margin: 20px;
        `;
  return {
    container: container,
  };
});

const UnThemedSlider: FunctionComponent<Props> = ({
  theme,
  min,
  max,
  onChange,
  orientation,
  size,
  reverse,
  formatTooltipResult,
}) => {
  const toltipSize = size || '200px';
  const isHorizontal = orientation === 'horizontal';
  const styles = getStyles(theme, orientation, toltipSize);
  const RangeWithTooltip = createSliderWithTooltip(Range);
  return (
    <div className={styles.container}>
      <RangeWithTooltip
        tipProps={{ visible: true, placement: isHorizontal ? 'top' : 'right' }}
        min={min}
        max={max}
        defaultValue={[min, max]}
        tipFormatter={(value: string | number) => (formatTooltipResult ? formatTooltipResult(value) : value)}
        onChange={onChange}
        vertical={!isHorizontal}
        reverse={reverse}
      />
    </div>
  );
};

export const Slider = withTheme(UnThemedSlider);
Slider.displayName = 'Slider';
