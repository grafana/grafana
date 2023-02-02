import React from 'react';

import { Alert } from '@grafana/ui/src';

export const NoUpsertPermissionsAlert = ({ mode }: { mode: 'create' | 'edit' }) => (
  <Alert severity="info" title={`You don’t have permission to ${mode} public dashboard`}>
    Contact your admin to get permission to {mode} public dashboard
  </Alert>
);
