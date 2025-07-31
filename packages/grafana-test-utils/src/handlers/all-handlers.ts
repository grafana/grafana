import { HttpHandler } from 'msw';

import teamsHandlers from './api/teams/handlers';

const allHandlers: HttpHandler[] = [...teamsHandlers];

export default allHandlers;
