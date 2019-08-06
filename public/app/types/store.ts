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

export interface StoreState {
  navIndex: NavIndex;
  location: LocationState;
  alertRules: AlertRulesState;
  teams: TeamsState;
  team: TeamState;
  folder: FolderState;
  dashboard: DashboardState;
  dataSources: DataSourcesState;
  explore: ExploreState;
  users: UsersState;
  organization: OrganizationState;
  appNotifications: AppNotificationsState;
  user: UserState;
  plugins: PluginsState;
  application: ApplicationState;
}

/*
 * Utility type to get strongly types thunks
 */
export type ThunkResult<R> = ThunkAction<R, StoreState, undefined, ActionOf<any>>;

export type ThunkDispatch = GenericThunkDispatch<StoreState, undefined, any>;
