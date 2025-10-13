import { HttpHandler } from 'msw';

import dashboardsHandlers from './api/dashboards/handlers';
import folderHandlers from './api/folders/handlers';
import pluginsHandlers from './api/plugins/handlers';
import searchHandlers from './api/search/handlers';
import teamsHandlers from './api/teams/handlers';
import userHandlers from './api/user/handlers';
import appPlatformDashboardv0alpha1Handlers from './apis/dashboard.grafana.app/v0alpha1/handlers';
import appPlatformDashboardv1beta1Handlers from './apis/dashboard.grafana.app/v1beta1/handlers';
import appPlatformFolderv1beta1Handlers from './apis/folder.grafana.app/v1beta1/handlers';
import appPlatformIamv0alpha1Handlers from './apis/iam.grafana.app/v0alpha1/handlers';

const allHandlers: HttpHandler[] = [
  // Legacy handlers
  ...teamsHandlers,
  ...dashboardsHandlers,
  ...folderHandlers,
  ...searchHandlers,
  ...pluginsHandlers,
  ...userHandlers,

  // App platform handlers
  ...appPlatformDashboardv0alpha1Handlers,
  ...appPlatformDashboardv1beta1Handlers,
  ...appPlatformFolderv1beta1Handlers,
  ...appPlatformIamv0alpha1Handlers,
];

export default allHandlers;
