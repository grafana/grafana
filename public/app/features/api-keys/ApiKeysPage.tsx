import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

// Utils
import { rangeUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { InlineField, InlineSwitch, VerticalGroup } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { AccessControlAction, ApiKey, NewApiKey, StoreState } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { APIKeysMigratedCard } from './APIKeysMigratedCard';
import { ApiKeysActionBar } from './ApiKeysActionBar';
import { ApiKeysAddedModal } from './ApiKeysAddedModal';
import { ApiKeysController } from './ApiKeysController';
import { ApiKeysForm } from './ApiKeysForm';
import { ApiKeysTable } from './ApiKeysTable';
import { MigrateToServiceAccountsCard } from './MigrateToServiceAccountsCard';
import {
  addApiKey,
  deleteApiKey,
  migrateApiKey,
  migrateAll,
  loadApiKeys,
  toggleIncludeExpired,
  getApiKeysMigrationStatus,
  hideApiKeys,
} from './state/actions';
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
    apiKeysMigrated: state.apiKeys.apiKeysMigrated,
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
  addApiKey,
  getApiKeysMigrationStatus,
  hideApiKeys,
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
    this.props.getApiKeysMigrationStatus();
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

  onAddApiKey = (newApiKey: NewApiKey) => {
    const openModal = (apiKey: string) => {
      const rootPath = window.location.origin + config.appSubUrl;

      appEvents.publish(
        new ShowModalReactEvent({
          props: {
            apiKey,
            rootPath,
          },
          component: ApiKeysAddedModal,
        })
      );
    };

    const secondsToLive = newApiKey.secondsToLive;
    try {
      const secondsToLiveAsNumber = secondsToLive ? rangeUtil.intervalToSeconds(secondsToLive) : null;
      const apiKey: ApiKey = {
        ...newApiKey,
        secondsToLive: secondsToLiveAsNumber,
      };
      this.props.addApiKey(apiKey, openModal);
      this.setState((prevState: State) => {
        return {
          ...prevState,
          isAdding: false,
        };
      });
    } catch (err) {
      console.error(err);
    }
  };

  onHideApiKeys = async () => {
    try {
      await this.props.hideApiKeys();
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
      apiKeysMigrated,
    } = this.props;

    if (!hasFetched) {
      return (
        <Page {...defaultPageProps}>
          <Page.Contents isLoading={true}>{}</Page.Contents>
        </Page>
      );
    }

    return (
      <Page {...defaultPageProps}>
        <Page.Contents isLoading={false}>
          <ApiKeysController>
            {({ isAdding, toggleIsAdding }) => {
              const showCTA = !isAdding && apiKeysCount === 0 && !apiKeysMigrated;
              const showTable = apiKeysCount > 0;
              return (
                <>
                  {!apiKeysMigrated && <MigrateToServiceAccountsCard onMigrate={this.onMigrateAll} />}
                  {apiKeysMigrated && <APIKeysMigratedCard onHideApiKeys={this.onHideApiKeys} />}
                  {showCTA ? (
                    <EmptyListCTA
                      title="You haven't added any API keys yet."
                      buttonIcon="key-skeleton-alt"
                      onClick={toggleIsAdding}
                      buttonTitle="New API key"
                      proTip="Remember, you can provide view-only API access to other applications."
                      buttonDisabled={!canCreate}
                    />
                  ) : null}
                  {showTable ? (
                    <ApiKeysActionBar
                      searchQuery={searchQuery}
                      disabled={isAdding || !canCreate}
                      onAddClick={toggleIsAdding}
                      onSearchChange={this.onSearchQueryChange}
                    />
                  ) : null}
                  <ApiKeysForm
                    show={isAdding}
                    onClose={toggleIsAdding}
                    onKeyAdded={this.onAddApiKey}
                    disabled={!canCreate}
                  />
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
              );
            }}
          </ApiKeysController>
        </Page.Contents>
      </Page>
    );
  }
}

const ApiKeysPage = connector(ApiKeysPageUnconnected);
export default ApiKeysPage;
