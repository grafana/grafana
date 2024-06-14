import { VizPanel } from '@grafana/scenes';
import { createAndCopyDashboardShortLink } from 'app/core/utils/shortLinks';
import { getTrackingSource } from 'app/features/dashboard/components/ShareModal/utils';

import store from '../../../../core/store';
import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';
import { ShareLinkConfiguration } from '../ShareLinkTab';

export const buildShareUrl = async (dashboard: DashboardScene, panel?: VizPanel) => {
  DashboardInteractions.shareLinkCopied({
    currentTimeRange: true,
    theme: 'current',
    shortenURL: true,
    shareResource: getTrackingSource(panel?.getRef()),
  });
  return await createAndCopyDashboardShortLink(dashboard, { useAbsoluteTimeRange: true, theme: 'current' });
};

type ShareLinkStoreConfiguration =
  | {
      useLockedTime: boolean;
      useShortUrl: boolean;
      theme: string;
    }
  | undefined;

const SHARE_LINK_CONFIGURATION = 'grafana.link.shareConfiguration';

// Function that returns share link configuration from local storage
export function getShareLinkConfigurationFromStorage(): ShareLinkConfiguration | undefined {
  if (store.exists(SHARE_LINK_CONFIGURATION)) {
    const config: ShareLinkStoreConfiguration = store.getObject(SHARE_LINK_CONFIGURATION);
    if (config) {
      return { ...config, selectedTheme: config.theme };
    }
  }

  return undefined;
}

export function updateShareLinkConfigurationFromStorage(config: ShareLinkConfiguration) {
  const { useLockedTime, useShortUrl, selectedTheme } = config;
  const updateConfig: ShareLinkStoreConfiguration = {
    useLockedTime,
    useShortUrl,
    theme: selectedTheme,
  };
  store.setObject(SHARE_LINK_CONFIGURATION, updateConfig);
}
