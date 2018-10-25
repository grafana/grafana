import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from '../../core/components/PageHeader/PageHeader';
import PageLoader from '../../core/components/PageLoader/PageLoader';
import { loadOrganization, loadOrganizationPreferences } from './state/actions';
import { DashboardAcl, NavModel, Organization, OrganisationPreferences, StoreState } from 'app/types';
import { getNavModel } from '../../core/selectors/navModel';
import OrgProfile from './OrgProfile';
import OrgPreferences from './OrgPreferences';

export interface Props {
  navModel: NavModel;
  organization: Organization;
  preferences: OrganisationPreferences;
  starredDashboards: DashboardAcl[];
  loadOrganization: typeof loadOrganization;
  loadOrganizationPreferences: typeof loadOrganizationPreferences;
}

interface State {
  orgName: string;
  theme: string;
  isReady: boolean;
  selectedDashboard: DashboardAcl;
}

export class OrgDetailsPage extends PureComponent<Props, State> {
  state = {
    orgName: '',
    theme: '',
    isReady: false,
    selectedDashboard: null,
  };

  async componentDidMount() {
    this.fetchOrganisation();
  }

  async fetchOrganisation() {
    const organization = await this.props.loadOrganization();
    // const preferences = await this.props.loadOrganizationPreferences();

    this.setState({
      orgName: organization.name,
      // theme: preferences.theme,
      isReady: true,
    });
  }

  onOrgNameChange = event => {
    this.setState({
      orgName: event.target.value,
    });
  };

  onSubmitForm = () => {};

  onSubmitPreferences = () => {};

  onDashboardSelected = dashboard => {
    this.setState({
      selectedDashboard: dashboard,
    });
  };

  render() {
    const { navModel, preferences, starredDashboards } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          {!this.state.isReady ? (
            <PageLoader pageName="Organisation" />
          ) : (
            <div>
              <OrgProfile
                onOrgNameChange={name => this.onOrgNameChange(name)}
                onSubmit={this.onSubmitForm}
                orgName={this.state.orgName}
              />
              <OrgPreferences
                preferences={preferences}
                starredDashboards={starredDashboards}
                onDashboardSelected={dashboard => this.onDashboardSelected(dashboard)}
                onTimeZoneChange={() => {}}
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
    organisation: state.organisation.organisation,
    preferences: state.organisation.preferences,
    starredDashboards: state.organisation.starredDashboards,
  };
}

const mapDispatchToProps = {
  loadOrganization,
  loadOrganizationPreferences,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(OrgDetailsPage));
