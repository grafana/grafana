import { type DashboardScene } from '../../scene/DashboardScene';
import { dashboardViews } from '../../scene/dashboardViewRegistry';

import { type ShareDrawerState } from './ShareDrawer';

type ShareDrawerOptions = Omit<ShareDrawerState, 'activeShare'>;

export async function openShareDrawer(dashboard: DashboardScene, options: ShareDrawerOptions) {
  await dashboard.loadView(dashboardViews.overlay.share(options));
}
