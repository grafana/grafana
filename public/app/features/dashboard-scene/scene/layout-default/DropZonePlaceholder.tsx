import { css } from '@emotion/css';
import classNames from 'classnames';
import { forwardRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Portal, useStyles2 } from '@grafana/ui';

interface DropZonePlaceholderProps {
  width: number;
  height: number;
  top: number;
  left: number;
}

export const DropZonePlaceholder = forwardRef<HTMLDivElement, DropZonePlaceholderProps>(
  ({ width, height, top, left }, ref) => {
    const styles = useStyles2(getStyles);
    // console.log(`DropZonePlaceHolder: w: ${width}, h: ${height}, l: ${left}, t: ${top}`);

    return (
      <Portal>
        <div
          className={classNames(styles.placeholder, {
            [styles.visible]: width > 0 && height > 0,
          })}
          style={{ width, height, transform: `translate(${left}px, ${top}px)` }}
          ref={ref}
        ></div>
      </Portal>
    );
  }
);

const getStyles = (theme: GrafanaTheme2) => ({
  placeholder: css({
    visibility: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: -1,
    pointerEvents: 'none',
    background: theme.colors.primary.transparent,
    boxShadow: `0 0 4px ${theme.colors.primary.border}`,
    '@keyframes activate': {
      '0%': {
        transition: 'unset',
      },
      '100%': {
        transition: 'transform 150ms ease',
      },
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      animation: '0s linear 151ms 1 normal forwards running activate',
    },
  }),
  visible: css({
    visibility: 'visible',
  }),
});
