import { ThunkAction, ThunkDispatch as GenericThunkDispatch } from 'redux-thunk';
import { PayloadAction } from '@reduxjs/toolkit';
import { NavIndex } from '@grafana/data';

import { LocationState } from './location';
import { AlertRulesState } from './alerting';
import { TeamsState, TeamState } from './teams';
import { FolderState } from './folders';
import { DashboardState } from './dashboard';
import { DataSourceSettingsState, DataSourcesState } from './datasources';
import { ExploreState } from './explore';
import { UserAdminState, UserListAdminState, UsersState, UserState } from './user';
import { OrganizationState } from './organization';
import { AppNotificationsState } from './appNotifications';
import { PluginsState } from './plugins';
import { ApplicationState } from './application';
import { LdapState } from './ldap';
import { PanelEditorState } from '../features/dashboard/components/PanelEditor/state/reducers';
import { ApiKeysState } from './apiKeys';
import { TemplatingState } from '../features/variables/state/reducers';
import { ImportDashboardState } from '../features/manage-dashboards/state/reducers';

export interface StoreState {
  navIndex: NavIndex;
  location: LocationState;
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
  application: ApplicationState;
  ldap: LdapState;
  apiKeys: ApiKeysState;
  userAdmin: UserAdminState;
  userListAdmin: UserListAdminState;
  templating: TemplatingState;
  importDashboard: ImportDashboardState;
}

/*
 * Utility type to get strongly types thunks
 */
export type ThunkResult<R> = ThunkAction<R, StoreState, undefined, PayloadAction<any>>;

export type ThunkDispatch = GenericThunkDispatch<StoreState, undefined, any>;
