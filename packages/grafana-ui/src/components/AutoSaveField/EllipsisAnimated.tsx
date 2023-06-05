import { css, keyframes } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '../../themes';

export const EllipsisAnimated = React.memo(() => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.ellipsis}>
      <span className={styles.firstDot}>.</span>
      <span className={styles.secondDot}>.</span>
      <span className={styles.thirdDot}>.</span>
    </div>
  );
});

EllipsisAnimated.displayName = 'EllipsisAnimated';

const getStyles = () => {
  return {
    ellipsis: css({
      display: 'inline',
    }),
    firstDot: css({
      animation: `${firstDot} 2s linear infinite`,
    }),
    secondDot: css({
      animation: `${secondDot} 2s linear infinite`,
    }),
    thirdDot: css({
      animation: `${thirdDot} 2s linear infinite`,
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
