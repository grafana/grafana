import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { achievementsByName } from 'app/features/achievements/AchievementsList';
import { getUserLevel } from 'app/features/achievements/AchievementsService';
import { GrotIcon } from 'app/features/achievements/GrotIcon';
import { useAchievements } from 'app/features/achievements/useAchievements';
import { getProgress } from 'app/features/achievements/utils';

export function TopNavBarMenuProgressBar() {
  const styles = useStyles2(getStyles);
  const [level, setLevel] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(achievementsByName[0]);
  const [levelProgress, setLevelProgress] = useState(0);

  getUserLevel().then((level) => {
    setLevel(level);
  });
  const { achievementsList } = useAchievements();
  const levels = achievementsByName;

  const progressWidth = `${
    (levels.indexOf(currentLevel) / levels.length) * 100 + ((100 / levels.length) * levelProgress) / 100
  }%`;

  useEffect(() => {
    const levelValidated = level && level > 0 ? level : 0;
    setCurrentLevel(achievementsByName[levelValidated]);

    const achievementsListByLevel =
      achievementsList && achievementsList.filter((achievement) => achievement.level === levelValidated + 1);

    const progressByLevel = achievementsListByLevel
      ? getProgress(
          achievementsListByLevel?.filter((achievement) => achievement.completed).length!,
          achievementsListByLevel.length
        )
      : 0;
    setLevelProgress(progressByLevel);
  }, [level, achievementsList]);

  return (
    <a href="/profile/achievements">
      <div className={styles.progressBarWrapper}>
        <div>
          <GrotIcon level={level} height={30} />
        </div>
        <div className={styles.progressBarRight}>
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
        </div>
      </div>
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    progressBarWrapper: css({
      display: 'flex',
    }),
    progressBarRight: css({
      width: '100%',
    }),
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
        borderRight: `1px solid ${theme.colors.text.secondary}`,
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
