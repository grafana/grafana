import React from 'react';

import { Alert } from '@grafana/ui/src';

export const SaveDashboardChangesAlert = () => (
  <Alert title="Please save your dashboard changes before updating the public configuration" severity="warning" />
);
