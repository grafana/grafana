import { AppEvents, FeatureToggles } from '@grafana/data';
import { config, getAppEvents } from '@grafana/runtime';

let sent = 0;
const requiredFeatureToggles: Array<keyof FeatureToggles> = [
  'kubernetesFolders',
  'kubernetesDashboards',
  'unifiedStorageSearch',
];

export function checkSetup() {
  const now = Date.now();
  if (now - sent > 10000) {
    requiredFeatureToggles.forEach((f) => {
      if (!config.featureToggles[f]) {
        console.warn('Provisioning is missing feature toggle: ', f);
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: ['Provisioning setup errors', 'Missing feature: ' + f],
        });
        sent = now;
      }
    });
  }
}
