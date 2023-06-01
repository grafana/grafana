import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

// Utils
// import { locationService } from '@grafana/runtime';
import { InlineField, InlineSwitch, VerticalGroup, Modal } from '@grafana/ui';
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
  operationSummaryVisible: boolean;
  operationSummaryData: MigrationResult;
}

export class ApiKeysPageUnconnected extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      operationSummaryVisible: false,
      operationSummaryData: {
        Total: 0,
        Migrated: 0,
        Failed: 0,
        FailedApikeyIDs: [0],
        FailedDetails: [],
      },
    };
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
      const response = await this.props.migrateAll();
      this.setState((prevState: State) => {
        return {
          ...prevState,
          operationSummaryVisible: true,
          operationSummaryData: response,
        };
      });
    } catch (err) {
      console.error(err);
    }
  };

  dismissModal = async () => {
    this.setState((prevState: State) => {
      return {
        ...prevState,
        operationSummaryVisible: false,
      };
    });
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
        <MigrationSummary
          visible={this.state.operationSummaryVisible}
          data={this.state.operationSummaryData}
          dismissModal={this.dismissModal}
        />
      </Page>
    );
  }
}
interface MigrationResult {
  Total: number;
  Migrated: number;
  Failed: number;
  FailedApikeyIDs: number[];
  FailedDetails: string[];
}

export type MigrationSummaryProps = {
  visible: boolean;
  data: MigrationResult;
  dismissModal: () => void;
};

const styles: { [key: string]: React.CSSProperties } = {
  migrationSummary: {
    padding: '20px',
  },
  infoText: {
    color: '#007bff',
  },
  summaryDetails: {
    marginTop: '20px',
  },
  summaryParagraph: {
    margin: '10px 0',
  },
};

export const MigrationSummary: React.FC<MigrationSummaryProps> = ({ visible, data, dismissModal }) => {
  if (!visible) {
    return null;
  }

  return (
    <Modal title="Migration summary" isOpen={true} closeOnBackdropClick={true} onDismiss={dismissModal}>
      <div style={styles.migrationSummary}>
        {data.FailedApikeyIDs.length !== 0 && (
          <p>Do not worry if you see failed API key migrations. All your API keys are functional and operational.</p>
        )}
        <hr />
        <p>
          <strong>Total: </strong>
          {data.Total}
        </p>
        <p>
          <strong>Migrated: </strong>
          {data.Migrated}
        </p>

        {data.FailedApikeyIDs.length !== 0 && (
          <div>
            <p>
              <strong>Failed: </strong>
              {data.Failed}
            </p>
            <p>
              <strong>Failed Api Key IDs: </strong>
              {data.FailedApikeyIDs.join(', ')}
            </p>
            <p>
              <strong>Failed Details: </strong>
              {data.FailedDetails.join(', ')}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

const ApiKeysPage = connector(ApiKeysPageUnconnected);
export default ApiKeysPage;
