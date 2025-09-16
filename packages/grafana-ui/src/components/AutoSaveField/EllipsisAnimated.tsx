import { css, keyframes } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

export const EllipsisAnimated = memo(() => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.ellipsis}>
      <span className={styles.firstDot}>{'.'}</span>
      <span className={styles.secondDot}>{'.'}</span>
      <span className={styles.thirdDot}>{'.'}</span>
    </div>
  );
});

EllipsisAnimated.displayName = 'EllipsisAnimated';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    ellipsis: css({
      display: 'inline',
    }),
    firstDot: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${firstDot} 2s linear infinite`,
      },
    }),
    secondDot: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${secondDot} 2s linear infinite`,
      },
    }),
    thirdDot: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${thirdDot} 2s linear infinite`,
      },
    }),
  };
};

const firstDot = keyframes`
  0% {
    opacity: 1;
  }
  65% {
    opacity: 1;
  }
  66% {
    opacity: 0.5;
  }
  100% {
    opacity: 0;
  }
  `;

const secondDot = keyframes`
  0% {
    opacity: 0;
  }
  21% {
    opacity: 0.5;
  }
  22% {
    opacity: 1;
  }
  65% {
    opacity: 1;
  }
  66% {
    opacity: 0.5;
  }
  100% {
    opacity: 0;
  }
  `;

const thirdDot = keyframes`
  0% {
    opacity: 0;
  }
  43% {
    opacity: 0.5;
  }
  44% {
    opacity: 1;
  }
  65% {
    opacity: 1;
  }
  66% {
    opacity: 0.5;
  }
  100% {
    opacity: 0;
  }
  `;
