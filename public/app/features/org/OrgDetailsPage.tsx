import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel } from '@grafana/data';

import Page from 'app/core/components/Page/Page';
import OrgProfile from './OrgProfile';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { loadOrganization, updateOrganization } from './state/actions';
import { Organization, StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { setOrganizationName } from './state/reducers';

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

  onOrgNameChange = (name: string) => {
    this.props.setOrganizationName(name);
  };

  onUpdateOrganization = () => {
    this.props.updateOrganization();
  };

  render() {
    const { navModel, organization } = this.props;
    const isLoading = Object.keys(organization).length === 0;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
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
        </Page.Contents>
      </Page>
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
