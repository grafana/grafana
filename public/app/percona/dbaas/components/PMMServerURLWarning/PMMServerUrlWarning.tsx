import React, { FC } from 'react';
import { Icon, useStyles } from '@grafana/ui';
import { cx } from '@emotion/css';
import { getStyles } from './PMMServerUrlWarning.styles';
import { PMMServerUrlWarningProps } from './PMMServerUrlWarning.types';
import { WarningMessage } from './WarningMessage/WarningMessage';

export const PMMServerUrlWarning: FC<PMMServerUrlWarningProps> = ({ className }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={cx(styles.warningWrapper, className)} data-testid="pmm-server-url-warning">
      <Icon name="exclamation-triangle" className={styles.warningIcon} />
      <span className={styles.warningMessage}>
        <WarningMessage className={styles.settingsLink} />
      </span>
    </div>
  );
};
