import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import Slider, { SliderProps } from 'rc-slider';
import React, { FunctionComponent, useCallback } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';

import HandleTooltip from './HandleTooltip';
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
  const handleChange = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? [v, v] : v;
      onChange?.(value);
    },
    [onChange]
  );

  const handleAfterChange = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? [v, v] : v;
      onAfterChange?.(value);
    },
    [onAfterChange]
  );

  const isHorizontal = orientation === 'horizontal';
  const theme = useTheme2();
  const styles = getStyles(theme, isHorizontal);

  const tipHandleRender: SliderProps['handleRender'] = (node, handleProps) => {
    return (
      <HandleTooltip
        value={handleProps.value}
        visible={tooltipAlwaysVisible || handleProps.dragging}
        tipFormatter={formatTooltipResult}
        placement={isHorizontal ? 'top' : 'right'}
      >
        {node}
      </HandleTooltip>
    );
  };

  return (
    <div className={cx(styles.container, styles.slider)}>
      {/** Slider tooltip's parent component is body and therefore we need Global component to do css overrides for it. */}
      <Global styles={styles.tooltip} />
      <Slider
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        range={true}
        onChange={handleChange}
        onAfterChange={handleAfterChange}
        vertical={!isHorizontal}
        reverse={reverse}
        // TODO: The following is a temporary work around for making content after the slider accessible and it will be removed when fixing the slider in public/app/features/explore/RichHistory/RichHistoryQueriesTab.tsx.
        tabIndex={[0, 1]}
        handleRender={tipHandleRender}
      />
    </div>
  );
};

RangeSlider.displayName = 'RangeSlider';
