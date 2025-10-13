import { css } from '@emotion/css';
import { CSSProperties } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface OverlayProps {
  topRight1?: React.ReactNode[];
  topRight2?: React.ReactNode[];
  bottomLeft?: React.ReactNode[];
  blStyle?: CSSProperties;
}

export const GeomapOverlay = ({ topRight1, topRight2, bottomLeft, blStyle }: OverlayProps) => {
  const topRight1Exists = (topRight1 && topRight1.length > 0) ?? false;
  const styles = useStyles2(getStyles(topRight1Exists));
  return (
    <div className={styles.overlay}>
      {Boolean(topRight1?.length) && <div className={styles.TR1}>{topRight1}</div>}
      {Boolean(topRight2?.length) && <div className={styles.TR2}>{topRight2}</div>}
      {Boolean(bottomLeft?.length) && (
        <div className={styles.BL} style={blStyle}>
          {bottomLeft}
        </div>
      )}
    </div>
  );
};

const getStyles = (topRight1Exists: boolean) => (theme: GrafanaTheme2) => ({
  overlay: css({
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 500,
    pointerEvents: 'none',
  }),
  TR1: css({
    right: '0.5em',
    pointerEvents: 'auto',
    position: 'absolute',
    top: '0.5em',
  }),
  TR2: css({
    position: 'absolute',
    top: topRight1Exists ? '80px' : '8px',
    right: '8px',
    pointerEvents: 'auto',
  }),
  BL: css({
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    pointerEvents: 'auto',
  }),
});
