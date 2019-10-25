import { ThunkAction, ThunkDispatch as GenericThunkDispatch } from 'redux-thunk';
import { ActionOf } from 'app/core/redux';

import { LocationState } from './location';
import { AlertRulesState } from './alerting';
import { TeamsState, TeamState } from './teams';
import { FolderState } from './folders';
import { DashboardState } from './dashboard';
import { DataSourcesState } from './datasources';
import { ExploreState } from './explore';
import { UsersState, UserState } from './user';
import { OrganizationState } from './organization';
import { AppNotificationsState } from './appNotifications';
import { PluginsState } from './plugins';
import { NavIndex } from '@grafana/data';
import { ApplicationState } from './application';
import { LdapState, LdapUserState } from './ldap';
import { PanelEditorState } from '../features/dashboard/panel_editor/state/reducers';
import { ApiKeysState } from './apiKeys';

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
  explore: ExploreState;
  users: UsersState;
  organization: OrganizationState;
  appNotifications: AppNotificationsState;
  user: UserState;
  plugins: PluginsState;
  application: ApplicationState;
  ldap: LdapState;
  ldapUser: LdapUserState;
  apiKeys: ApiKeysState;
}

/*
 * Utility type to get strongly types thunks
 */
export type ThunkResult<R> = ThunkAction<R, StoreState, undefined, ActionOf<any>>;

export type ThunkDispatch = GenericThunkDispatch<StoreState, undefined, any>;
