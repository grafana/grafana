import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  levels: string[];
  currentLevel: string;
  totalLevelAchievements: number;
  currentLevelAchievement: number;
}

export function TopNavBarMenuProgressBar({
  levels,
  currentLevel,
  totalLevelAchievements,
  currentLevelAchievement,
}: Props) {
  const styles = useStyles2(getStyles);

  const progressWidth = `${
    (levels.indexOf(currentLevel) / levels.length) * 100 +
    ((100 / levels.length) * currentLevelAchievement) / totalLevelAchievements
  }%`;

  return (
    <a href="/profile">
      <div className={styles.progressBarHeader}>
        Level: <span>{currentLevel}</span>
      </div>
      <div className={styles.progressBar}>
        <span className={styles.progressBarLine} style={{ width: progressWidth }}></span>
        <div className={styles.progressBarTiers}>
          {levels.map((level, i) => (
            <span key={i} className={styles.progressBarTier}></span>
          ))}
        </div>
      </div>
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    progressBarHeader: css({
      color: theme.colors.text.primary,
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.body.fontWeight,
      span: {
        color: theme.colors.text.secondary,
      },
    }),
    progressBar: css({
      border: `1px solid ${theme.colors.border.strong}`,
      padding: '2px',
      borderRadius: theme.shape.radius.default,
      position: 'relative',
      height: '10px',
    }),
    progressBarLine: css({
      display: 'block',
      height: '8px',
      backgroundColor: theme.colors.warning.main,
      position: 'absolute',
      top: 0,
      left: 0,
    }),
    progressBarTiers: css({
      position: 'absolute',
      top: 0,
      left: 0,
      display: 'flex',
      width: '100%',

      span: {
        borderRight: `2px solid ${theme.colors.background.primary}`,
      },

      'span:last-child': {
        border: 'none',
      },
    }),
    progressBarTier: css({
      width: '100%',
      height: '8px',
    }),
  };
};
