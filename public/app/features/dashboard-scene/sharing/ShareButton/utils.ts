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

const DEFAULT_SHARE_LINK_CONFIGURATION: ShareLinkConfiguration = {
  useAbsoluteTimeRange: true,
  useShortUrl: true,
  theme: 'current',
};

export const buildShareUrl = async (dashboard: DashboardScene, panel?: VizPanel) => {
  const { useAbsoluteTimeRange, useShortUrl, theme } = getShareLinkConfiguration();
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

const SHARE_LINK_CONFIGURATION = 'grafana.dashboard.link.shareConfiguration';
// Function that returns share link configuration from local storage
export function getShareLinkConfiguration(): ShareLinkConfiguration {
  if (store.exists(SHARE_LINK_CONFIGURATION)) {
    return store.getObject(SHARE_LINK_CONFIGURATION) || DEFAULT_SHARE_LINK_CONFIGURATION;
  }

  return DEFAULT_SHARE_LINK_CONFIGURATION;
}

export function updateShareLinkConfiguration(config: ShareLinkConfiguration) {
  store.setObject(SHARE_LINK_CONFIGURATION, config);
}
