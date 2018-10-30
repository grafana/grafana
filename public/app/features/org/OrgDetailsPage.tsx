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
  updateOrganization,
} from './state/actions';
import { loadStarredDashboards } from '../../core/actions/user';
import { NavModel, Organization, OrganizationPreferences, StoreState } from 'app/types';
import { getNavModel } from '../../core/selectors/navModel';

export interface Props {
  navModel: NavModel;
  organization: Organization;
  preferences: OrganizationPreferences;
  loadOrganization: typeof loadOrganization;
  loadOrganizationPreferences: typeof loadOrganizationPreferences;
  loadStarredDashboards: typeof loadStarredDashboards;
  setOrganizationName: typeof setOrganizationName;
  updateOrganization: typeof updateOrganization;
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

  render() {
    const { navModel, organization, preferences } = this.props;

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
              <OrgPreferences />
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
  };
}

const mapDispatchToProps = {
  loadOrganization,
  loadOrganizationPreferences,
  loadStarredDashboards,
  setOrganizationName,
  updateOrganization,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(OrgDetailsPage));
