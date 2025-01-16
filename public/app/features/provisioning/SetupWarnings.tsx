import { ReactNode, useMemo } from 'react';

import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';

export function SetupWarnings() {
  return useMemo(() => {
    const alerts: ReactNode[] = [];
    const requiredFeatureToggles: Array<keyof FeatureToggles> = [
      'kubernetesFolders',
      'kubernetesDashboards',
      'unifiedStorageSearch',
    ];
    for (let f of requiredFeatureToggles) {
      if (!config.featureToggles[f]) {
        alerts.push(
          <Alert title="Provisioning setup error" severity="error">
            Missing required feature toggle: {f}
          </Alert>
        );
      }
    }
    return alerts;
  }, []);
}
