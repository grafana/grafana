import { AppEvents } from '@grafana/data';
import { config, getAppEvents } from '@grafana/runtime';

let sent = 0;

export function checkSetup() {
  const now = Date.now();
  if (!config.featureToggles.unifiedStorageSearch && now - sent > 10000) {
    sent = now;
    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload: ['Provisioning setup errors', 'Missing feature: unifiedStorageSearch'],
    });
  }
}
