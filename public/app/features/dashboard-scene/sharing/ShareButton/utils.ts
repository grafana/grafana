import { VizPanel } from '@grafana/scenes';
import { createAndCopyShareDashboardLink } from 'app/core/utils/shortLinks';
import { getTrackingSource } from 'app/features/dashboard/components/ShareModal/utils';

import store from '../../../../core/store';
import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

export type ShareLinkConfiguration = {
  useAbsoluteTimeRange: boolean;
  useShortUrl: boolean;
  theme: string;
};

export const DEFAULT_SHARE_LINK_CONFIGURATION: ShareLinkConfiguration = {
  useAbsoluteTimeRange: true,
  useShortUrl: true,
  theme: 'current',
};

export const buildShareUrl = async (dashboard: DashboardScene, panel?: VizPanel) => {
  const { useAbsoluteTimeRange, useShortUrl, theme } =
    getShareLinkConfigurationFromStorage() || DEFAULT_SHARE_LINK_CONFIGURATION;
  DashboardInteractions.shareLinkCopied({
    currentTimeRange: useAbsoluteTimeRange,
    theme,
    shortenURL: useShortUrl,
    shareResource: getTrackingSource(panel?.getRef()),
  });
  return await createAndCopyShareDashboardLink(dashboard, {
    useAbsoluteTimeRange,
    theme,
    useShortUrl,
  });
};

type ShareLinkStoreConfiguration = ShareLinkConfiguration | undefined;
const SHARE_LINK_CONFIGURATION = 'grafana.link.shareConfiguration';
// Function that returns share link configuration from local storage
export function getShareLinkConfigurationFromStorage(): ShareLinkStoreConfiguration | undefined {
  if (store.exists(SHARE_LINK_CONFIGURATION)) {
    return store.getObject(SHARE_LINK_CONFIGURATION);
  }

  return undefined;
}

export function updateShareLinkConfigurationFromStorage(config: ShareLinkStoreConfiguration) {
  store.setObject(SHARE_LINK_CONFIGURATION, config);
}
