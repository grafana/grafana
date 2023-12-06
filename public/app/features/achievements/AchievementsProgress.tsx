import { css } from '@emotion/css';
import LinearProgress, { LinearProgressProps } from '@mui/material/LinearProgress';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { useAchievements } from './useAchievements';

const ACHIEVEMENTS_TOTAL = 27;

export const AchievementsProgress = ({ value = 30 }: LinearProgressProps) => {
  const styles = useStyles2(getStyles);
  const { achievementsList } = useAchievements();

  const completedAchievements = achievementsList?.filter((achievement) => achievement.completed).length! + 1;
  const progress = Math.round((completedAchievements / ACHIEVEMENTS_TOTAL) * 100);

  return (
    <div className={styles.wrapper}>
      <div className={styles.titleWrapper}>
        <p>Progress</p>
        <span>
          {completedAchievements} of {ACHIEVEMENTS_TOTAL} complete
        </span>
      </div>
      <LinearProgress variant="determinate" value={progress} className={styles.progressBar} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: theme.spacing(2),
  }),
  titleWrapper: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  }),
  progressBar: css({
    '& > *': {
      backgroundColor: '#F55F3E !important',
    },
    backgroundColor: `${theme.colors.background.secondary} !important`,
  }),
});
