import React, { FunctionComponent } from 'react';
import { Range as RangeComponent, createSliderWithTooltip } from 'rc-slider';
import { cx } from 'emotion';
import { Global } from '@emotion/core';
import { useTheme } from '../../themes/ThemeContext';
import { getStyles } from './styles';
import { RangeSliderProps } from './types';

/**
 * @public
 *
 * RichHistoryQueriesTab uses this Range Component
 */
export const RangeSlider: FunctionComponent<RangeSliderProps> = ({
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
  const RangeWithTooltip = createSliderWithTooltip(RangeComponent);
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
        defaultValue={value}
        tipFormatter={(value: number) => (formatTooltipResult ? formatTooltipResult(value) : value)}
        onChange={onChange}
        onAfterChange={onAfterChange}
        vertical={!isHorizontal}
        reverse={reverse}
      />
    </div>
  );
};

RangeSlider.displayName = 'Range';
