//
// Location
//

export interface LocationUpdate {
  path?: string;
  query?: UrlQueryMap;
  routeParams?: UrlQueryMap;
}

export interface LocationState {
  url: string;
  path: string;
  query: UrlQueryMap;
  routeParams: UrlQueryMap;
}

export type UrlQueryValue = string | number | boolean | string[] | number[] | boolean[];
export type UrlQueryMap = { [s: string]: UrlQueryValue };

//
// Alerting
//

export interface AlertRuleApi {
  id: number;
  dashboardId: number;
  dashboardUid: string;
  dashboardSlug: string;
  panelId: number;
  name: string;
  state: string;
  newStateDate: string;
  evalDate: string;
  evalData?: object;
  executionError: string;
  url: string;
}

export interface AlertRule {
  id: number;
  dashboardId: number;
  panelId: number;
  name: string;
  state: string;
  stateText: string;
  stateIcon: string;
  stateClass: string;
  stateAge: string;
  url: string;
  info?: string;
  executionError?: string;
  evalData?: { noData: boolean };
}

//
// Teams
//

export interface Team {
  id: number;
  name: string;
  avatarUrl: string;
  email: string;
  memberCount: number;
  search?: string;
  members?: TeamMember[];
  groups?: TeamGroup[];
}

export interface TeamMember {
  userId: number;
  teamId: number;
  avatarUrl: string;
  email: string;
  login: string;
}

export interface TeamGroup {
  groupId: string;
  teamId: number;
}

//
// NavModel
//

export interface NavModelItem {
  text: string;
  url: string;
  subTitle?: string;
  icon?: string;
  img?: string;
  id: string;
  active?: boolean;
  hideFromTabs?: boolean;
  divider?: boolean;
  children?: NavModelItem[];
  breadcrumbs?: { title: string; url: string }[];
  target?: string;
  parentItem?: NavModelItem;
}

export interface NavModel {
  main: NavModelItem;
  node: NavModelItem;
}

export type NavIndex = { [s: string]: NavModelItem };

//
// Store
//

export interface AlertRulesState {
  items: AlertRule[];
  searchQuery: string;
}

export interface TeamsState {
  teams: Team[];
  searchQuery: string;
}

export interface TeamState {
  team: Team;
  searchQuery: string;
}

export interface StoreState {
  navIndex: NavIndex;
  location: LocationState;
  alertRules: AlertRulesState;
  teams: TeamsState;
}
