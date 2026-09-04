import { type DashboardScene } from '../../scene/DashboardScene';

import { type ShareDrawerState } from './ShareDrawer';

type ShareDrawerOptions = Omit<ShareDrawerState, 'activeShare'>;

export async function loadShareDrawer(options: ShareDrawerOptions) {
  const { ShareDrawer } = await import(/* webpackChunkName: "share-drawer" */ './ShareDrawer');
  return new ShareDrawer(options);
}

export async function openShareDrawer(dashboard: DashboardScene, options: ShareDrawerOptions) {
  dashboard.showModal(await loadShareDrawer(options));
}
