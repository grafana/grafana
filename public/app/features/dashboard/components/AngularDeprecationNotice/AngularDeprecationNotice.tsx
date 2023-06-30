import React from 'react';

import { Alert } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';

const LOCAL_STORAGE_KEY_PREFIX = 'grafana.angularDeprecation.dashboardNotice.isDismissed';

function localStorageKey(dashboardUid: string): string {
  return LOCAL_STORAGE_KEY_PREFIX + '.' + dashboardUid;
}

export interface Props {
  dashboardUid: string;
}

export function AngularDeprecationNotice({ dashboardUid }: Props) {
  return (
    <LocalStorageValueProvider<boolean> storageKey={localStorageKey(dashboardUid)} defaultValue={false}>
      {(isDismissed, onDismiss) => {
        if (isDismissed) {
          return null;
        }
        return (
          <div>
            <Alert
              severity="warning"
              title="This dashboard is using deprecated plugin APIs."
              onRemove={() => {
                onDismiss(true);
              }}
            >
              There are panels or datasources in this dashboard that are using deprecated plugin APIs.
            </Alert>
          </div>
        );
      }}
    </LocalStorageValueProvider>
  );
}
