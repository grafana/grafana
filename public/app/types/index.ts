import { Team, TeamsState, TeamState, TeamGroup, TeamMember } from './teams';
import { AlertRuleDTO, AlertRule, AlertRulesState } from './alerting';
import { LocationState, LocationUpdate, UrlQueryMap, UrlQueryValue } from './location';
import { NavModel, NavModelItem, NavIndex } from './navModel';
import {
  DashboardSection,
  DashboardSectionItem,
  DashboardQuery,
  ManageDashboard,
  SectionsState,
  ManageDashboardState,
} from './manageDashboard';

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
  DashboardQuery,
  DashboardSection,
  DashboardSectionItem,
  ManageDashboard,
  SectionsState,
  ManageDashboardState,
};

export interface StoreState {
  navIndex: NavIndex;
  location: LocationState;
  alertRules: AlertRulesState;
  teams: TeamsState;
  team: TeamState;
  manageDashboards: ManageDashboardState;
}
