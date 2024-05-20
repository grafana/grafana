import { VizPanel } from '@grafana/scenes';

import { createAndCopyDashboardShortLink } from '../../../../core/utils/shortLinks';
import { getTrackingSource } from '../../../dashboard/components/ShareModal/utils';
import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

export const buildShareUrl = async (dashboard: DashboardScene, panel?: VizPanel) => {
  DashboardInteractions.shareLinkCopied({
    currentTimeRange: true,
    theme: 'current',
    shortenURL: true,
    shareResource: getTrackingSource(panel?.getRef()),
  });
  return await createAndCopyDashboardShortLink(dashboard, { useAbsoluteTimeRange: true, theme: 'current' });
};
