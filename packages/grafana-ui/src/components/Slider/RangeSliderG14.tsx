import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import Slider, { type SliderProps } from '@rc-component/slider';
import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';

import HandleTooltip from './HandleTooltip';
import { getStyles } from './styles';
import { type RangeSliderG14Props } from './types';

export const RangeSliderG14 = ({
  min,
  max,
  defaultValue,
  ariaLabelForHandle,
  onChange,
  onAfterChange,
  orientation = 'horizontal',
  reverse,
  step,
  formatTooltipResult,
  value,
  tooltipAlwaysVisible = true,
}: RangeSliderG14Props) => {
  const handleChange = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? [v, v] : v;
      onChange?.(value);
    },
    [onChange]
  );

  const handleChangeComplete = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? [v, v] : v;
      onAfterChange?.(value);
    },
    [onAfterChange]
  );

  const isHorizontal = orientation === 'horizontal';
  const styles = useStyles2(getStyles, isHorizontal);
  const dragHandleAriaLabel = t('grafana-ui.range-slider.drag-handle-aria-label', 'Use arrow keys to change the value');

  const tipHandleRender: SliderProps['handleRender'] = (node, handleProps) => {
    return (
      <HandleTooltip
        value={handleProps.value}
        visible={tooltipAlwaysVisible || handleProps.dragging}
        tipFormatter={formatTooltipResult ? () => formatTooltipResult(handleProps.value) : undefined}
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
        defaultValue={defaultValue}
        value={value}
        range={true}
        onChange={handleChange}
        onChangeComplete={handleChangeComplete}
        vertical={!isHorizontal}
        reverse={reverse}
        handleRender={tipHandleRender}
        ariaLabelForHandle={ariaLabelForHandle ?? dragHandleAriaLabel}
      />
    </div>
  );
};

RangeSliderG14.displayName = 'RangeSliderG14';
