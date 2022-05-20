import { getConfig } from '../../../core/config';

export const isPublicDashboardView = () => {
  return getConfig().featureToggles.publicDashboards && window.location.pathname.split('/')[1] === 'p';
};
