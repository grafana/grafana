import React, { FunctionComponent } from 'react';
import { Range as RangeComponent, createSliderWithTooltip } from 'rc-slider';
import { cx } from 'emotion';
import { Global } from '@emotion/core';
import { useTheme } from '../../themes/ThemeContext';
import { Orientation } from '../../types/orientation';
import { getStyles } from './styles';

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
  onChange?: (value: number[]) => void;
  onAfterChange?: (value: number[]) => void;
}

/** RichHistoryQueriesTab uses this Range Component */
export const RangeSlider: FunctionComponent<Props> = ({
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
