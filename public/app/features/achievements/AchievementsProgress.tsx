import { css } from '@emotion/css';
import React, { CSSProperties } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { TopNavBarMenuProgressBar } from 'app/core/components/AppChrome/TopBar/TopNavBarMenuProgressBar';

export const AchievementsProgress = () => {
  const styles = useStyles2(getStyles);
  const iconStyles: CSSProperties = {
    height: '90px',
    marginTop: '-13px',
    marginRight: '10px',
  };

  return (
    <div className={styles.wrapper}>
      <TopNavBarMenuProgressBar iconStyles={iconStyles} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '24px 0 40px 0',
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
