import { config } from '../../../core/config';

export const isPublicDashboardView = () => {
  return config.featureToggles.publicDashboards && window.location.pathname.split('/')[1] === 'p';
};
