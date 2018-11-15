import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from '../../core/components/PageHeader/PageHeader';
import PageLoader from '../../core/components/PageLoader/PageLoader';
import OrgProfile from './OrgProfile';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { loadOrganization, setOrganizationName, updateOrganization } from './state/actions';
import { NavModel, Organization, StoreState } from 'app/types';
import { getNavModel } from '../../core/selectors/navModel';

export interface Props {
  navModel: NavModel;
  organization: Organization;
  loadOrganization: typeof loadOrganization;
  setOrganizationName: typeof setOrganizationName;
  updateOrganization: typeof updateOrganization;
}

export class OrgDetailsPage extends PureComponent<Props> {
  async componentDidMount() {
    await this.props.loadOrganization();
  }

  onOrgNameChange = name => {
    this.props.setOrganizationName(name);
  };

  onUpdateOrganization = () => {
    this.props.updateOrganization();
  };

  render() {
    const { navModel, organization } = this.props;
    const isLoading = Object.keys(organization).length === 0;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          {isLoading && <PageLoader pageName="Organization" />}
          {!isLoading && (
            <div>
              <OrgProfile
                onOrgNameChange={name => this.onOrgNameChange(name)}
                onSubmit={this.onUpdateOrganization}
                orgName={organization.name}
              />
              <SharedPreferences resourceUri="org" />
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
  };
}

const mapDispatchToProps = {
  loadOrganization,
  setOrganizationName,
  updateOrganization,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(OrgDetailsPage));
