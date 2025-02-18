import { css } from '@emotion/css';
import { forwardRef, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface FloatingPanelProps {
  width: number;
  height: number;
  offset: { left: number; top: number };
  children: ReactNode;
}

export const FloatingPanel = forwardRef<HTMLDivElement, FloatingPanelProps>(
  ({ width, height, offset, children }: FloatingPanelProps, ref) => {
    const styles = useStyles2(getStyles);

    return (
      <div
        className={styles.container}
        style={{
          translate: `${offset.left}px ${offset.top}px`,
          // transform: `translate(${e.clientX}px,${e.clientY}px)`,
          width: `${width}px`,
          height: `${height}px`,
        }}
        ref={ref}
      >
        {children}
      </div>
    );
  }
);

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'fixed',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    zIndex: '999999',
    visibility: 'hidden',
    border: '1px solid white',
  }),
});
