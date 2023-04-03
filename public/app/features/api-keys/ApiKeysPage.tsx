import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

// Utils
import { locationService } from '@grafana/runtime';
import { InlineField, InlineSwitch, VerticalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { AccessControlAction, ApiKey, StoreState } from 'app/types';

import { ApiKeysActionBar } from './ApiKeysActionBar';
import { ApiKeysTable } from './ApiKeysTable';
import { MigrateToServiceAccountsCard } from './MigrateToServiceAccountsCard';
import { deleteApiKey, migrateApiKey, migrateAll, loadApiKeys, toggleIncludeExpired } from './state/actions';
import { setSearchQuery } from './state/reducers';
import { getApiKeys, getApiKeysCount, getIncludeExpired, getIncludeExpiredDisabled } from './state/selectors';

function mapStateToProps(state: StoreState) {
  const canCreate = contextSrv.hasAccess(AccessControlAction.ActionAPIKeysCreate, true);

  return {
    apiKeys: getApiKeys(state.apiKeys),
    searchQuery: state.apiKeys.searchQuery,
    apiKeysCount: getApiKeysCount(state.apiKeys),
    hasFetched: state.apiKeys.hasFetched,
    timeZone: getTimeZone(state.user),
    includeExpired: getIncludeExpired(state.apiKeys),
    includeExpiredDisabled: getIncludeExpiredDisabled(state.apiKeys),
    canCreate: canCreate,
  };
}

const defaultPageProps = {
  navId: 'apikeys',
};

const mapDispatchToProps = {
  loadApiKeys,
  deleteApiKey,
  migrateApiKey,
  migrateAll,
  setSearchQuery,
  toggleIncludeExpired,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

interface State {
  isAdding: boolean;
}

export class ApiKeysPageUnconnected extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    this.fetchApiKeys();
  }

  async fetchApiKeys() {
    await this.props.loadApiKeys();
  }

  onDeleteApiKey = (key: ApiKey) => {
    this.props.deleteApiKey(key.id!);
  };

  onMigrateAll = () => {
    this.props.migrateAll();
  };

  onMigrateApiKey = (key: ApiKey) => {
    this.props.migrateApiKey(key.id!);
  };

  onSearchQueryChange = (value: string) => {
    this.props.setSearchQuery(value);
  };

  onIncludeExpiredChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    this.props.toggleIncludeExpired();
  };

  onMigrateApiKeys = async () => {
    try {
      this.onMigrateAll();
      let serviceAccountsUrl = '/org/serviceaccounts';
      locationService.push(serviceAccountsUrl);
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  render() {
    const {
      hasFetched,
      apiKeysCount,
      apiKeys,
      searchQuery,
      timeZone,
      includeExpired,
      includeExpiredDisabled,
      canCreate,
    } = this.props;

    if (!hasFetched) {
      return (
        <Page {...defaultPageProps}>
          <Page.Contents isLoading={true}>{}</Page.Contents>
        </Page>
      );
    }

    const showTable = apiKeysCount > 0;
    return (
      <Page {...defaultPageProps}>
        <Page.Contents isLoading={false}>
          <>
            <MigrateToServiceAccountsCard onMigrate={this.onMigrateApiKeys} apikeysCount={apiKeysCount} />
            {showTable ? (
              <ApiKeysActionBar
                searchQuery={searchQuery}
                disabled={!canCreate}
                onSearchChange={this.onSearchQueryChange}
              />
            ) : null}
            {showTable ? (
              <VerticalGroup>
                <InlineField disabled={includeExpiredDisabled} label="Include expired keys">
                  <InlineSwitch id="showExpired" value={includeExpired} onChange={this.onIncludeExpiredChange} />
                </InlineField>
                <ApiKeysTable
                  apiKeys={apiKeys}
                  timeZone={timeZone}
                  onMigrate={this.onMigrateApiKey}
                  onDelete={this.onDeleteApiKey}
                />
              </VerticalGroup>
            ) : null}
          </>
        </Page.Contents>
      </Page>
    );
  }
}

const ApiKeysPage = connector(ApiKeysPageUnconnected);
export default ApiKeysPage;
