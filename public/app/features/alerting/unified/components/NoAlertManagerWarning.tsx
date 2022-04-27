import React from 'react';

import { Alert } from '@grafana/ui';

export const NoAlertManagerWarning = () => {
  return (
    <div>
      <Alert title="No alert managers available" severity="warning">
        There are no alert managers available. Probably there are no external alert managers configured and you do not
        have access to built-in Grafana Alert Manager
      </Alert>
    </div>
  );
};
