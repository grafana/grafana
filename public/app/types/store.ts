import { ThunkAction, ThunkDispatch as GenericThunkDispatch } from 'redux-thunk';
import { Action, PayloadAction } from '@reduxjs/toolkit';
import { NavIndex } from '@grafana/data';
import { AlertRulesState, NotificationChannelState } from './alerting';
import { UnifiedAlertingState } from '../features/alerting/unified/state/reducers';
import { TeamsState, TeamState } from './teams';
import { FolderState } from './folders';
import { DashboardState } from './dashboard';
import { DataSourceSettingsState, DataSourcesState } from './datasources';
import { ExploreState } from './explore';
import { UserAdminState, UserListAdminState, UsersState } from './user';
import { OrganizationState } from './organization';
import { AppNotificationsState } from './appNotifications';
import { PluginsState } from './plugins';
import { LdapState } from './ldap';
import { PanelEditorState } from '../features/dashboard/components/PanelEditor/state/reducers';
import { ApiKeysState } from './apiKeys';
import { TemplatingState } from '../features/variables/state/reducers';
import { ImportDashboardState } from '../features/manage-dashboards/state/reducers';
import { UserState } from 'app/features/profile/state/reducers';

export interface StoreState {
  navIndex: NavIndex;
  alertRules: AlertRulesState;
  teams: TeamsState;
  team: TeamState;
  folder: FolderState;
  dashboard: DashboardState;
  panelEditor: PanelEditorState;
  dataSources: DataSourcesState;
  dataSourceSettings: DataSourceSettingsState;
  explore: ExploreState;
  users: UsersState;
  organization: OrganizationState;
  appNotifications: AppNotificationsState;
  user: UserState;
  plugins: PluginsState;
  ldap: LdapState;
  apiKeys: ApiKeysState;
  userAdmin: UserAdminState;
  userListAdmin: UserListAdminState;
  templating: TemplatingState;
  importDashboard: ImportDashboardState;
  notificationChannel: NotificationChannelState;
  unifiedAlerting: UnifiedAlertingState;
}

/*
 * Utility type to get strongly types thunks
 */
export type ThunkResult<R> = ThunkAction<R, StoreState, undefined, PayloadAction<any>>;

export type ThunkDispatch = GenericThunkDispatch<StoreState, undefined, Action>;
