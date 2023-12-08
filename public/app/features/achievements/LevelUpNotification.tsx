import { css, keyframes } from '@emotion/css';
import React from 'react';
import Confetti from 'react-confetti';
import toast, { Toast } from 'react-hot-toast';
import { useWindowSize } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';

import { achievementsByName } from './AchievementsList';
import { GrotIcon } from './GrotIcon';
import logo from './assets/logo.svg';

type LevelUpNotificationProps = {
  title: string;
  level: number;
  toaster: Toast;
};

export const LevelUpNotification = ({ title, level, toaster }: LevelUpNotificationProps) => {
  const styles = useStyles2(getStyles);
  const { width, height } = useWindowSize();

  return (
    <div className={styles.wrapper} onClick={() => toast.dismiss(toaster.id)}>
      {/* todo: move this element to the app level to avoid center calculation based on parent element;
       /* 323px - width of the parent element; need to achieve center position */}
      <div style={{ position: 'absolute', left: `-${width / 2 - 323 / 2}px`, top: '-18px' }}>
        <Confetti
          width={width}
          height={height}
          numberOfPieces={100}
          drawShape={(ctx) => {
            const img = new Image();
            img.src = logo;
            ctx.drawImage(img, 0, 0, 24, 24);
          }}
        />
      </div>
      <div className={styles.text}>
        <h2>LEVEL UP!</h2>
      </div>
      <div className={styles.levelIcons}>
        <GrotIcon level={level - 1} width={100} height={100} />
        <GrotIcon level={level} width={100} height={100} />
      </div>
      <h3 className={styles.text}>{achievementsByName[level]}</h3>
      <div className={styles.footer}>
        <LinkButton fill="text" variant="secondary" href="/profile/achievements">
          View Achievements
        </LinkButton>
        <LinkButton fill="text" variant="secondary" href="/profile">
          Share
        </LinkButton>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    text: css({
      textAlign: 'center',
      padding: '20px',
    }),
    levelIcons: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: '20px',
      padding: '20px',
    }),
    footer: css({
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-between',
      gap: '4px',
      padding: '20px',
    }),
  };
};

const slideLeft = keyframes`
  from {width: 0px;}
  to {width: 300px;}
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
