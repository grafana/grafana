import React from 'react';
import { css } from '@emotion/css';
import { noop } from 'lodash';
import { GrafanaTheme } from '@grafana/data';
import { Icon, useStyles } from '@grafana/ui';

type VersionHistoryHeaderProps = {
  isComparing?: boolean;
  onClick?: () => void;
  baseVersion?: number;
  newVersion?: number;
  isNewLatest?: boolean;
};

export const VersionHistoryHeader: React.FC<VersionHistoryHeaderProps> = ({
  isComparing = false,
  onClick = noop,
  baseVersion = 0,
  newVersion = 0,
  isNewLatest = false,
}) => {
  const styles = useStyles(getStyles);

  return (
    <h3 className={styles.header}>
      <span onClick={onClick} className={isComparing ? 'pointer' : ''}>
        Versions
      </span>
      {isComparing && (
        <span>
          <Icon name="angle-right" /> Comparing {baseVersion} <Icon name="arrows-h" /> {newVersion}{' '}
          {isNewLatest && <cite className="muted">(Latest)</cite>}
        </span>
      )}
    </h3>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  header: css`
    font-size: ${theme.typography.heading.h3};
    margin-bottom: ${theme.spacing.lg};
  `,
});
