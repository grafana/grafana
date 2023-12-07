import { css, keyframes } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { GrotIcon } from './GrotIcon';

type AchievementNotificationProps = {
  title: string;
  level: number;
};

export const AchievementNotification = ({ title, level }: AchievementNotificationProps) => {
  const styles = useStyles2(getStyles);

  return (
    <a href="/profile/achievements" className={styles.toast}>
      <GrotIcon level={level} width={64} height={64} animation={bounce} />
      <div className={styles.toastText}>
        <h3>Achievement Unlocked!</h3>
        <h5>{title}</h5>
      </div>
    </a>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    toast: css({
      display: 'flex',
    }),
    toastText: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '4px',
      h3: { margin: 0 },
      h5: {
        margin: 0,
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      },
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      width: '0px',
      animation: `${slideLeft} 1s ease-in-out 0.5s`,
      animationFillMode: 'forwards',
    }),
  };
};

const slideLeft = keyframes`
  from {width: 0px;}
  to {width: 250px;}
`;

const bounce = keyframes`
  from, 20%, 53%, 80%, to {
    transform: translate3d(0,0,0);
  }

  40%, 43% {
    transform: translate3d(0, -30px, 0);
  }

  70% {
    transform: translate3d(0, -15px, 0);
  }

  90% {
    transform: translate3d(0,-4px,0);
  }
`;
