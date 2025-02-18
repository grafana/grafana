import { css } from '@emotion/css';
import classNames from 'classnames';
import { forwardRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface DropZonePlaceholderProps {
  width: number;
  height: number;
  left: number;
  top: number;
}

export const DropZonePlaceholder = forwardRef<HTMLDivElement, DropZonePlaceholderProps>(
  ({ width, height, left, top }, ref) => {
    const styles = useStyles2(getStyles);

    return (
      <div
        className={classNames('react-grid-item', 'react-grid-placeholder', styles.placeholder)}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          translate: `${left}px ${top}px`,
        }}
        ref={ref}
      ></div>
    );
  }
);

const getStyles = (theme: GrafanaTheme2) => ({
  placeholder: css({
    position: 'fixed',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    zIndex: '1000',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'transform 150ms ease',
    },
  }),
});
