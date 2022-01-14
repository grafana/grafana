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

export interface State {}

const ITEMS_PER_PAGE = 30;

export class ServiceAccountsListPage extends PureComponent<Props, State> {
  componentDidMount() {
    this.fetchServiceAccounts();
  }

  async fetchServiceAccounts() {
    return this.props.loadServiceAccounts();
  }

  onRoleChange = (role: OrgRole, serviceAccount: OrgServiceAccount) => {
    const updatedServiceAccount = { ...serviceAccount, role: role };

    this.props.updateServiceAccount(updatedServiceAccount);
  };

  getPaginatedServiceAccounts = (serviceAccounts: OrgServiceAccount[]) => {
    const offset = (this.props.searchPage - 1) * ITEMS_PER_PAGE;
    return serviceAccounts.slice(offset, offset + ITEMS_PER_PAGE);
  };

  renderTable() {
    const { serviceAccounts } = this.props;
    const paginatedServiceAccounts = this.getPaginatedServiceAccounts(serviceAccounts);
    const totalPages = Math.ceil(serviceAccounts.length / ITEMS_PER_PAGE);

    return (
      <VerticalGroup spacing="md">
        <h1>Service Accounts</h1>
        <ServiceAccountsTable
          serviceAccounts={paginatedServiceAccounts}
          onRoleChange={(role, serviceAccount) => this.onRoleChange(role, serviceAccount)}
          onRemoveServiceAccount={(serviceAccount) => this.props.removeServiceAccount(serviceAccount.serviceAccountId)}
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
    hasFetched: state.serviceAccounts.isLoading,
  };
}

const mapDispatchToProps = {
  loadServiceAccounts,
  updateServiceAccount,
  removeServiceAccount,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(ServiceAccountsListPage);
