import { css } from '@emotion/css';
import LinearProgress, { LinearProgressProps } from '@mui/material/LinearProgress';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const AchievementsProgress = ({ value = 30 }: LinearProgressProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.titleWrapper}>
        <p>Progress</p>
        <span>30 of 100 complete</span>
      </div>
      <LinearProgress variant="determinate" value={value} className={styles.progressBar} />
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
