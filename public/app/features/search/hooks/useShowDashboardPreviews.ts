import { useLocalStorage } from 'react-use';

import { config } from '@grafana/runtime/src';

import { PREVIEWS_LOCAL_STORAGE_KEY } from '../constants';

export const useShowDashboardPreviews = () => {
  const previewFeatureEnabled = Boolean(config.featureToggles.dashboardPreviews);
  const [showPreviews, setShowPreviews] = useLocalStorage<boolean>(PREVIEWS_LOCAL_STORAGE_KEY, previewFeatureEnabled);

  return { showPreviews: Boolean(showPreviews && previewFeatureEnabled), previewFeatureEnabled, setShowPreviews };
};
