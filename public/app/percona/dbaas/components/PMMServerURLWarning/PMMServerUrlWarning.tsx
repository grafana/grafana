import { cx } from '@emotion/css';
import React, { FC } from 'react';
import { Link } from 'react-router-dom';

import { Alert, useStyles } from '@grafana/ui';

import { getStyles } from './PMMServerUrlWarning.styles';

export const PMMServerUrlWarning: FC<PMMServerUrlWarningProps> = ({ className }) => {
  const styles = useStyles(getStyles);
  return (
    <Alert
      className={cx(styles.alert, className)}
      title="PMM Public Address"
      severity="info"
      data-testid="pmm-server-url-warning"
    >
      <p>
        This will also set &quot;Public Address&quot; as {window.location.host}. If you need to set it differently or
        edit later, use <Link to="/settings/advanced-settings">Advanced Settings</Link>.
      </p>
    </Alert>
  );
};
