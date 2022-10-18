import { css } from '@emotion/css';
import Tooltip from 'rc-tooltip';
import React, { useEffect, useRef } from 'react';

interface RCTooltipRef {
  // rc-tooltip's ref is essentially untyped, so we be cautious by saying the function is
  // potentially undefined which, given rc's track record, seems likely :)
  forcePopupAlign?: () => {};
}

const HandleTooltip = (props: {
  value: number;
  children: React.ReactElement;
  visible: boolean;
  placement: 'top' | 'right';
  tipFormatter?: (value: number) => React.ReactNode;
}) => {
  const { value, children, visible, placement, tipFormatter, ...restProps } = props;

  const tooltipRef = useRef<RCTooltipRef>();
  const rafRef = useRef<number | null>(null);
  const styles = tooltipStyles();

  function cancelKeepAlign() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
  }

  function keepAlign() {
    rafRef.current = requestAnimationFrame(() => {
      tooltipRef.current?.forcePopupAlign?.();
    });
  }

  useEffect(() => {
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
      placement={placement}
      overlay={tipFormatter ?? value}
      overlayInnerStyle={{ minHeight: 'auto' }}
      ref={tooltipRef}
      visible={visible}
      {...restProps}
    >
      {children}
    </Tooltip>
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
      padding: 3,
    }),
  };
};

export default HandleTooltip;
