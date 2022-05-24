import { locationUtil } from '@grafana/data/src';

import { getConfig } from '../../../core/config';

export const isPublicDashboardView = () => {
  return (
    getConfig().featureToggles.publicDashboards &&
    locationUtil.stripBaseFromUrl(window.location.pathname).split('/')[1] === 'public-dashboards'
  );
};
