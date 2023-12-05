import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  level: string;
  totalAchievement: number;
  currentAchievement: number;
}

export function TopNavBarMenuProgressBar({ level, totalAchievement, currentAchievement }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.progressBarHeader}>
        Level: <span>{level}</span>
      </div>
      <div className={styles.progressBar}>
        <span
          className={styles.progressBarFill}
          style={{ width: `${(currentAchievement / totalAchievement) * 100}%` }}
        ></span>
      </div>
      <span className={styles.progressBarCaption}>
        {`${currentAchievement} of ${totalAchievement} achievements earned`}
      </span>
    </div>
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
    }),
    progressBarFill: css({
      display: 'block',
      height: '8px',
      backgroundColor: theme.colors.warning.main,
    }),
    progressBarCaption: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.body.fontWeight,
    }),
  };
};
