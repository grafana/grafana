import { HttpHandler } from 'msw';

import folderHandlers from './api/folders/handlers';
import searchHandlers from './api/search/handlers';
import teamsHandlers from './api/teams/handlers';
import appPlatformFolderHandlers from './apis/dashboard.grafana.app/v0alpha1/handlers';

const allHandlers: HttpHandler[] = [
  ...teamsHandlers,
  ...folderHandlers,
  ...searchHandlers,
  ...appPlatformFolderHandlers,
];

export default allHandlers;
