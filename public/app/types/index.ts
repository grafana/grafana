import { Team, TeamsState, TeamState, TeamGroup, TeamMember } from './teams';
import { AlertRuleDTO, AlertRule, AlertRulesState } from './alerting';
import { LocationState, LocationUpdate, UrlQueryMap, UrlQueryValue } from './location';
import { NavModel, NavModelItem, NavIndex } from './navModel';
import { FolderDTO, FolderState, FolderInfo } from './folders';
import { DashboardState } from './dashboard';
import { DashboardAcl, OrgRole, PermissionLevel } from './acl';
import { ApiKey, ApiKeysState, NewApiKey } from './apiKeys';
import { Invitee, OrgUser, User, UsersState } from './user';
import { DataSource, DataSourcesState } from './datasources';
import { PluginDashboard, PluginMeta, Plugin, PluginsState } from './plugins';
import { AppNotification, AlertsState } from './alerts';

export {
  Team,
  TeamsState,
  TeamState,
  TeamGroup,
  TeamMember,
  AlertRuleDTO,
  AlertRule,
  AlertRulesState,
  LocationState,
  LocationUpdate,
  NavModel,
  NavModelItem,
  NavIndex,
  UrlQueryMap,
  UrlQueryValue,
  FolderDTO,
  FolderState,
  FolderInfo,
  DashboardState,
  DashboardAcl,
  OrgRole,
  PermissionLevel,
  DataSource,
  PluginMeta,
  ApiKey,
  ApiKeysState,
  NewApiKey,
  Plugin,
  PluginsState,
  DataSourcesState,
  Invitee,
  OrgUser,
  User,
  UsersState,
  PluginDashboard,
  AppNotification,
  AlertsState,
};

export interface StoreState {
  navIndex: NavIndex;
  location: LocationState;
  alertRules: AlertRulesState;
  teams: TeamsState;
  team: TeamState;
  folder: FolderState;
  dashboard: DashboardState;
  dataSources: DataSourcesState;
  users: UsersState;
  alerts: AlertsState;
}
