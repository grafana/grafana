import { css } from '@emotion/css';
import { noop } from 'lodash';
import React from 'react';

import { GrafanaTheme } from '@grafana/data';
import { Icon, IconButton, useStyles } from '@grafana/ui';

type VersionHistoryHeaderProps = {
  onClick?: () => void;
  baseVersion?: number;
  newVersion?: number;
  isNewLatest?: boolean;
};

export const VersionHistoryHeader: React.FC<VersionHistoryHeaderProps> = ({
  onClick = noop,
  baseVersion = 0,
  newVersion = 0,
  isNewLatest = false,
}) => {
  const styles = useStyles(getStyles);

  return (
    <h3 className={styles.header}>
      <IconButton name="arrow-left" size="xl" onClick={onClick} />
      <span>
        Comparing {baseVersion} <Icon name="arrows-h" /> {newVersion}{' '}
        {isNewLatest && <cite className="muted">(Latest)</cite>}
      </span>
    </h3>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  header: css`
    font-size: ${theme.typography.heading.h3};
    display: flex;
    gap: ${theme.spacing.md};
    margin-bottom: ${theme.spacing.lg};
  `,
});
