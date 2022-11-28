import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import { Range as RangeComponent, createSliderWithTooltip } from 'rc-slider';
import React, { FunctionComponent } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';

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
  const theme = useTheme2();
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
        // TODO: The following is a temporary work around for making content after the slider accessible and it will be removed when fixing the slider in public/app/features/explore/RichHistory/RichHistoryQueriesTab.tsx.
        tabIndex={[0, 1]}
      />
    </div>
  );
};

RangeSlider.displayName = 'Range';
