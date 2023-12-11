import React from 'react';

import { Alert } from '@grafana/ui';

export const readOnlyMessage =
  'This data source was added by config and cannot be modified using the UI. Please contact your server admin to update this data source.';

export function DataSourceReadOnlyMessage() {
  return (
    <Alert severity="info" title="Provisioned data source">
      {readOnlyMessage}
    </Alert>
  );
}
