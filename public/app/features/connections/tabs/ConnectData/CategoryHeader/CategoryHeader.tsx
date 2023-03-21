import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  categoryHeader: css`
    align-items: center;
    display: flex;
    margin-bottom: 24px;
  `,
  categoryLabel: css`
    margin-bottom: 0px;
    margin-left: 8px;
  `,
});

type Props = { iconName: IconName; label: string };

export const CategoryHeader = ({ iconName, label }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.categoryHeader}>
      <Icon name={iconName} size="xl" />
      <h3 className={styles.categoryLabel}>{label}</h3>
    </div>
  );
};
