import { PREVIEWS_LOCAL_STORAGE_KEY } from '../constants';
import { config, reportInteraction } from '@grafana/runtime/src';
import { useLocalStorage } from 'react-use';

export const useShowDashboardPreviews = () => {
  const previewsFeatureEnabled = Boolean(config.featureToggles.dashboardPreviews);
  const [showPreviews, setShowPreviews] = useLocalStorage<boolean>(PREVIEWS_LOCAL_STORAGE_KEY, previewsFeatureEnabled);
  const onShowPreviewsChange = (showPreviews: boolean) => {
    reportInteraction(`${showPreviews ? 'enabled' : 'disabled'}_dashboard_previews`);
    setShowPreviews(showPreviews);
  };

  return { showPreviews: showPreviews && previewsFeatureEnabled, onShowPreviewsChange };
};
