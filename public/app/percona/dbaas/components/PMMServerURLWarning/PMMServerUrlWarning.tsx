import React, { FC } from 'react';
import { Link } from 'react-router-dom';

import { Alert } from '@grafana/ui';

export const PMMServerUrlWarning: FC<PMMServerUrlWarningProps> = ({ className }) => (
  <Alert className={className} title="PMM Public Address" severity="info" data-testid="pmm-server-url-warning">
    <p>
      This will also set &quot;Public Address&quot; as {window.location.host}.<br></br>
      If you need to set it differently or edit later, use{' '}
      <Link to="/settings/advanced-settings">Advanced Settings</Link>.
    </p>
  </Alert>
);
