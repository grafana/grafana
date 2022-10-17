import { cx, css } from '@emotion/css';
import { Global } from '@emotion/react';
import Slider, { SliderProps } from 'rc-slider';
import Tooltip from 'rc-tooltip';
import React, { FunctionComponent } from 'react';
// import 'rc-tooltip/assets/bootstrap.css';

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
  // const RangeWithTooltip = createSliderWithTooltip(RangeComponent);

  const tipHandleRender: SliderProps['handleRender'] = (node, handleProps) => {
    return (
      <HandleTooltip
        value={handleProps.value}
        visible={handleProps.dragging}
        tipFormatter={(value: number) => (formatTooltipResult ? formatTooltipResult(value) : value)}
        // {...tipProps}
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
        // tipProps={{
        //   visible: tooltipAlwaysVisible,
        //   placement: isHorizontal ? 'top' : 'right',
        // }}
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        range={true}
        // onChange={onChange}
        // onAfterChange={onAfterChange}
        vertical={!isHorizontal}
        reverse={reverse}
        // TODO: The following is a temporary work around for making content after the slider accessible and it will be removed when fixing the slider in public/app/features/explore/RichHistory/RichHistoryQueriesTab.tsx.
        tabIndex={[0, 1]}
        handleRender={tipHandleRender}
      />
    </div>
  );
};

const HandleTooltip = (props: {
  value: number;
  children: React.ReactElement;
  visible: boolean;
  tipFormatter?: (value: number) => React.ReactNode;
}) => {
  const styles = tooltipStyles();
  const { value, children, visible, tipFormatter = (val) => `${val} %`, ...restProps } = props;

  const tooltipRef = React.useRef<any>();
  const rafRef = React.useRef<number | null>(null);

  function cancelKeepAlign() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
  }

  function keepAlign() {
    rafRef.current = requestAnimationFrame(() => {
      tooltipRef.current?.forcePopupAlign();
    });
  }

  React.useEffect(() => {
    if (visible) {
      keepAlign();
    } else {
      cancelKeepAlign();
    }

    return cancelKeepAlign;
  }, [value, visible]);

  return (
    <Tooltip
      overlayClassName={styles.tooltip}
      placement="top"
      overlay={tipFormatter(value)}
      overlayInnerStyle={{ minHeight: 'auto' }}
      ref={tooltipRef}
      visible={true}
      {...restProps}
    >
      {children}
    </Tooltip>
  );
};

export const handleRender: SliderProps['handleRender'] = (node, props) => {
  return (
    <HandleTooltip value={props.value} visible={props.dragging}>
      {node}
    </HandleTooltip>
  );
};

const tooltipStyles = () => {
  return {
    tooltip: css({
      position: 'absolute',
      zIndex: 1070,
      display: 'block',
      visibility: 'visible',
      fontSize: 12,
      lineHeight: 1.5,
      opacity: 0.9,
    }),
  };
};

RangeSlider.displayName = 'Range';
