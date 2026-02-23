import { FeatureToggles, store } from '@grafana/data';

type AlertingPreviewToggles = Pick<FeatureToggles, 'alertingListViewV2'>;

const previewToggleStoreKey = 'grafana.alerting.previewToggles';

/**
 * Get the preview toggle value for the given toggle name.
 * @returns The value of the preview toggle or undefined if it is not set.
 */
export function getPreviewToggle(previewToggleName: keyof AlertingPreviewToggles): boolean | undefined {
  const previewToggles = store.getObject<AlertingPreviewToggles>(previewToggleStoreKey, {});

  return previewToggles[previewToggleName];
}

export function setPreviewToggle(previewToggleName: keyof AlertingPreviewToggles, value: boolean | undefined) {
  const previewToggles = store.getObject<AlertingPreviewToggles>(previewToggleStoreKey, {});

  previewToggles[previewToggleName] = value;
  store.setObject(previewToggleStoreKey, previewToggles);
}
