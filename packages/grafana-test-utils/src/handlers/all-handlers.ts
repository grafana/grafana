import { HttpHandler } from 'msw';

import folderHandlers from './api/folders/handlers';
import teamsHandlers from './api/teams/handlers';
import appPlatformFolderHandlers from './apis/dashboard.grafana.app/v0alpha1/handlers';

const allHandlers: HttpHandler[] = [...teamsHandlers, ...folderHandlers, ...appPlatformFolderHandlers];

export default allHandlers;
