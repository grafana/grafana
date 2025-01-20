import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Text } from '@grafana/ui';

const requiredFeatureToggles: Array<keyof FeatureToggles> = [
  'kubernetesDashboards',
  'kubernetesFoldersServiceV2',
  'kubernetesDashboards',
  'grafanaAPIServerWithExperimentalAPIs',
  // 'unifiedStorage', // FIXME: not assignable to keyof FeatureToggles
  'unifiedStorageSearch',
  'unifiedStorageSearchUI',
  'kubernetesCliDashboards',
];

export function SetupWarnings() {
  const missingFeatures = requiredFeatureToggles.filter((feature) => !config.featureToggles[feature]);

  if (missingFeatures.length === 0) {
    return null;
  }

  return (
    <Alert title="Provisioning Setup Error" severity="error">
      {missingFeatures.map((feature) => (
        <Text key={feature} element={'p'}>
          Missing required feature toggle: <strong>{feature}</strong>
        </Text>
      ))}
    </Alert>
  );
}
