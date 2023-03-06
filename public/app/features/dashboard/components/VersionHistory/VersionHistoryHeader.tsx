import { css } from '@emotion/css';
import { noop } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';

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
  const styles = useStyles2(getStyles);

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

const getStyles = (theme: GrafanaTheme2) => ({
  header: css`
    font-size: ${theme.typography.h3.fontSize};
    display: flex;
    gap: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(3)};
  `,
});
