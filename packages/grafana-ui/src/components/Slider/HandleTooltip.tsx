import { css } from '@emotion/css';
import Tooltip, { TooltipRef } from 'rc-tooltip';
import { useEffect, useRef } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

const HandleTooltip = (props: {
  value: number;
  children: React.ReactElement;
  visible: boolean;
  placement: 'top' | 'right';
  tipFormatter?: () => React.ReactNode;
}) => {
  const { value, children, visible, placement, tipFormatter, ...restProps } = props;

  const tooltipRef = useRef<TooltipRef>(null);
  const rafRef = useRef<number | null>(null);
  const styles = useStyles2(tooltipStyles);

  function cancelKeepAlign() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
  }

  function keepAlign() {
    rafRef.current = requestAnimationFrame(() => {
      tooltipRef.current?.forceAlign();
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

const tooltipStyles = (theme: GrafanaTheme2) => {
  return {
    tooltip: css({
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      fontSize: theme.typography.bodySmall.fontSize,
      opacity: 0.9,
      padding: 3,
      zIndex: theme.zIndex.tooltip,
    }),
  };
};

export default HandleTooltip;
