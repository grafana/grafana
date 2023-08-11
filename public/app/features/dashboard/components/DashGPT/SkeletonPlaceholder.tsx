import { css, keyframes } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { lighten } from '@grafana/data/src/themes/colorManipulator';
import { useStyles2 } from '@grafana/ui';

interface SkeletonPlaceholderProps {
  style?: React.CSSProperties;
}

export const SkeletonPlaceholder = ({ style }: SkeletonPlaceholderProps) => {
  const styles = useStyles2(getStyles);

  return <div className={styles.skeletonBox} style={style}></div>;
};

const getStyles = (theme: GrafanaTheme2) => {
  const progress = keyframes`
     0% {
       transform: translate3d(-100%, 0, 0);
     }
     100% {
       transform: translate3d(100%, 0, 0);
     }
  `;

  const colorBase = theme.colors.background.primary; //'#181b1f';
  const colorHighlight = lighten(colorBase, 0.02);

  return {
    skeletonBox: css({
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
      height: '40px',
      backgroundColor: `${colorBase}`,

      '&::after': {
        content: "''",
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `linear-gradient(90deg, ${colorBase}, ${colorHighlight}, ${colorBase})`,
        animation: `${progress} 3s ease-in-out infinite`,
      },
    }),
  };
};
