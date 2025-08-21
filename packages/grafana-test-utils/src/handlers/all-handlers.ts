import { HttpHandler } from 'msw';

import folderHandlers from './api/folders/handlers';
import teamsHandlers from './api/teams/handlers';
import appPlatformDashboardv0alpha1Handlers from './apis/dashboard.grafana.app/v0alpha1/handlers';
import appPlatformFolderv1beta1Handlers from './apis/folder.grafana.app/v1beta1/handlers';
import appPlatformIamv0alpha1Handlers from './apis/iam.grafana.app/v0alpha1/handlers';

const allHandlers: HttpHandler[] = [
  ...teamsHandlers,
  ...folderHandlers,
  ...appPlatformDashboardv0alpha1Handlers,
  ...appPlatformFolderv1beta1Handlers,
  ...appPlatformIamv0alpha1Handlers,
];

export default allHandlers;
