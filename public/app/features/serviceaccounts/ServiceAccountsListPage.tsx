import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { HorizontalGroup, Pagination, VerticalGroup } from '@grafana/ui';

import Page from 'app/core/components/Page/Page';
import ServiceAccountsTable from './ServiceAccountsTable';
import { OrgServiceaccount, OrgRole, StoreState } from 'app/types';
import { loadserviceaccounts, removeserviceaccount, updateserviceaccount } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getServiceaccounts, getserviceaccountsSearchPage, getserviceaccountsSearchQuery } from './state/selectors';
import { setserviceaccountsSearchPage } from './state/reducers';

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'serviceaccounts'),
    serviceaccounts: getServiceaccounts(state.serviceaccounts),
    searchQuery: getserviceaccountsSearchQuery(state.serviceaccounts),
    searchPage: getserviceaccountsSearchPage(state.serviceaccounts),
    hasFetched: state.serviceaccounts.hasFetched,
  };
}

const mapDispatchToProps = {
  loadserviceaccounts,
  updateserviceaccount,
  removeserviceaccount,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = ConnectedProps<typeof connector>;

export interface State {
  showInvites: boolean;
}

const pageLimit = 30;

export class ServiceaccountsListPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    this.fetchServiceaccounts();
  }

  async fetchServiceaccounts() {
    return await this.props.loadserviceaccounts();
  }

  onRoleChange = (role: OrgRole, serviceaccount: OrgServiceaccount) => {
    const updatedServiceaccount = { ...serviceaccount, role: role };

    this.props.updateserviceaccount(updatedServiceaccount);
  };

  getPaginatedServiceaccounts = (serviceaccounts: OrgServiceaccount[]) => {
    const offset = (this.props.searchPage - 1) * pageLimit;
    return serviceaccounts.slice(offset, offset + pageLimit);
  };

  renderTable() {
    const { serviceaccounts } = this.props;
    const paginatedServiceaccounts = this.getPaginatedServiceaccounts(serviceaccounts);
    const totalPages = Math.ceil(serviceaccounts.length / pageLimit);

    return (
      <VerticalGroup spacing="md">
        <ServiceAccountsTable
          serviceaccounts={paginatedServiceaccounts}
          onRoleChange={(role, serviceaccount) => this.onRoleChange(role, serviceaccount)}
          onRemoveServiceaccount={(serviceaccount) => this.props.removeserviceaccount(serviceaccount.serviceaccountId)}
        />
        <HorizontalGroup justify="flex-end">
          <Pagination
            onNavigate={setserviceaccountsSearchPage}
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

export default connector(ServiceaccountsListPage);
