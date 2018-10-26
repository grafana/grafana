import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from '../../core/components/PageHeader/PageHeader';
import PageLoader from '../../core/components/PageLoader/PageLoader';
import OrgProfile from './OrgProfile';
import OrgPreferences from './OrgPreferences';
import {
  loadOrganization,
  loadOrganizationPreferences,
  setOrganizationName,
  setOrganizationTheme,
  setOrganizationHomeDashboard,
  setOrganizationTimezone,
  updateOrganization,
  updateOrganizationPreferences,
} from './state/actions';
import { loadStarredDashboards } from '../dashboard/state/actions';
import { DashboardAcl, NavModel, Organization, OrganizationPreferences, StoreState } from 'app/types';
import { getNavModel } from '../../core/selectors/navModel';

export interface Props {
  navModel: NavModel;
  organization: Organization;
  preferences: OrganizationPreferences;
  starredDashboards: DashboardAcl[];
  loadOrganization: typeof loadOrganization;
  loadOrganizationPreferences: typeof loadOrganizationPreferences;
  loadStarredDashboards: typeof loadStarredDashboards;
  setOrganizationName: typeof setOrganizationName;
  setOrganizationHomeDashboard: typeof setOrganizationHomeDashboard;
  setOrganizationTheme: typeof setOrganizationTheme;
  setOrganizationTimezone: typeof setOrganizationTimezone;
  updateOrganization: typeof updateOrganization;
  updateOrganizationPreferences: typeof updateOrganizationPreferences;
}

export class OrgDetailsPage extends PureComponent<Props> {
  async componentDidMount() {
    await this.props.loadStarredDashboards();
    await this.props.loadOrganization();
    await this.props.loadOrganizationPreferences();
  }

  onOrgNameChange = name => {
    this.props.setOrganizationName(name);
  };

  onUpdateOrganization = () => {
    this.props.updateOrganization();
  };

  onSubmitPreferences = () => {
    this.props.updateOrganizationPreferences();
  };

  onThemeChange = theme => {
    this.props.setOrganizationTheme(theme);
  };

  onHomeDashboardChange = dashboardId => {
    this.props.setOrganizationHomeDashboard(dashboardId);
  };

  onTimeZoneChange = timeZone => {
    this.props.setOrganizationTimezone(timeZone);
  };

  render() {
    const { navModel, organization, preferences, starredDashboards } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          {Object.keys(organization).length === 0 || Object.keys(preferences).length === 0 ? (
            <PageLoader pageName="Organization" />
          ) : (
            <div>
              <OrgProfile
                onOrgNameChange={name => this.onOrgNameChange(name)}
                onSubmit={this.onUpdateOrganization}
                orgName={organization.name}
              />
              <OrgPreferences
                preferences={preferences}
                starredDashboards={starredDashboards}
                onDashboardChange={dashboardId => this.onHomeDashboardChange(dashboardId)}
                onThemeChange={theme => this.onThemeChange(theme)}
                onTimeZoneChange={timeZone => this.onTimeZoneChange(timeZone)}
                onSubmit={this.onSubmitPreferences}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'org-settings'),
    organization: state.organization.organization,
    preferences: state.organization.preferences,
    starredDashboards: state.organization.starredDashboards,
  };
}

const mapDispatchToProps = {
  loadOrganization,
  loadOrganizationPreferences,
  loadStarredDashboards,
  setOrganizationName,
  setOrganizationTheme,
  setOrganizationHomeDashboard,
  setOrganizationTimezone,
  updateOrganization,
  updateOrganizationPreferences,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(OrgDetailsPage));
