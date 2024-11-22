import { NavItem } from 'types';

export const PLUGIN_ID = "grafana-playlist-app";
export const PLUGIN_BASE_URL = `/a/${PLUGIN_ID}`;
export const PLUGIN_API_URL = `/api/plugins/${PLUGIN_ID}/resources/v1`;

export enum ROUTES {
  Main = 'todos',
}

export const NAVIGATION_TITLE = 'Basic App Plugin';
export const NAVIGATION_SUBTITLE = 'Some extra description...';

// Add a navigation item for each route you would like to display in the navigation bar
export const NAVIGATION: Record<string, NavItem> = {
  [ROUTES.Main]: {
    id: ROUTES.Main,
    text: 'Main Page',
    icon: 'database',
    url: `${PLUGIN_BASE_URL}/main`,
  },
};
