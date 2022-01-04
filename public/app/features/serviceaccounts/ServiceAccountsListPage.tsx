import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { HorizontalGroup, Pagination, VerticalGroup } from '@grafana/ui';

import Page from 'app/core/components/Page/Page';
import ServiceAccountsTable from './ServiceAccountsTable';
import { OrgServiceAccount, OrgRole, StoreState } from 'app/types';
import { loadServiceAccounts, removeServiceAccount, updateServiceAccount } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getServiceAccounts, getServiceAccountsSearchPage, getServiceAccountsSearchQuery } from './state/selectors';
import { setServiceAccountsSearchPage } from './state/reducers';
export type Props = ConnectedProps<typeof connector>;

export interface State {
  showInvites: boolean;
}

const pageLimit = 30;

export class ServiceAccountsListPage extends PureComponent<Props, State> {
  componentDidMount() {
    this.fetchServiceaccounts();
  }

  async fetchServiceaccounts() {
    return this.props.loadServiceAccounts();
  }

  onRoleChange = (role: OrgRole, serviceAccount: OrgServiceAccount) => {
    const updatedServiceaccount = { ...serviceAccount, role: role };

    this.props.updateServiceAccount(updatedServiceaccount);
  };

  onShowInvites = () => {
    this.setState((prevState) => ({
      showInvites: !prevState.showInvites,
    }));
  };

  getPaginatedServiceAccounts = (serviceAccounts: OrgServiceAccount[]) => {
    const offset = (this.props.searchPage - 1) * pageLimit;
    return serviceAccounts.slice(offset, offset + pageLimit);
  };

  renderTable() {
    const { serviceAccounts } = this.props;
    const paginatedServiceAccounts = this.getPaginatedServiceAccounts(serviceAccounts);
    const totalPages = Math.ceil(serviceAccounts.length / pageLimit);

    if (this.state.showInvites) {
      return <></>;
    } else {
      return (
        <VerticalGroup spacing="md">
          <ServiceAccountsTable
            serviceAccounts={paginatedServiceAccounts}
            onRoleChange={(role, serviceAccount) => this.onRoleChange(role, serviceAccount)}
            onRemoveServiceaccount={(serviceAccount) =>
              this.props.removeServiceAccount(serviceAccount.serviceAccountId)
            }
          />
          <HorizontalGroup justify="flex-end">
            <Pagination
              onNavigate={setServiceAccountsSearchPage}
              currentPage={this.props.searchPage}
              numberOfPages={totalPages}
              hideWhenSinglePage={true}
            />
          </HorizontalGroup>
        </VerticalGroup>
      );
    }
  }

  render() {
    const { navModel, hasFetched } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={!hasFetched}>
          <>{hasFetched && this.renderTable()}</>
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'serviceaccounts'),
    serviceAccounts: getServiceAccounts(state.serviceAccounts),
    searchQuery: getServiceAccountsSearchQuery(state.serviceAccounts),
    searchPage: getServiceAccountsSearchPage(state.serviceAccounts),
    hasFetched: state.serviceAccounts.hasFetched,
  };
}

const mapDispatchToProps = {
  loadServiceAccounts,
  updateServiceAccount,
  removeServiceAccount,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(ServiceAccountsListPage);
