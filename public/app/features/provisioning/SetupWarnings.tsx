import { ReactNode, useMemo } from 'react';

import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';

const requiredFeatureToggles: Array<keyof FeatureToggles> = [
  'kubernetesFolders',
  'kubernetesDashboards',
  'unifiedStorageSearch',
];

export function SetupWarnings() {
  const missingFeatures = requiredFeatureToggles.filter(
    (feature) => !config.featureToggles[feature]
  );

  if (missingFeatures.length === 0) {
    return null;
  }

  return (
    <>
      {missingFeatures.map((feature) => (
        <Alert key={feature} title="Provisioning Setup Error" severity="error">
          Missing required feature toggle: <strong>{feature}</strong>
        </Alert>
      ))}
    </>
  );
}
