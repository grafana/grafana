import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

// Utils
import { InlineField, InlineSwitch, VerticalGroup, Modal, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { AccessControlAction, ApiKey, ApikeyMigrationResult, StoreState } from 'app/types';

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
    migrationResult: state.apiKeys.migrationResult,
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
  showMigrationResult: boolean;
}

export class ApiKeysPageUnconnected extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showMigrationResult: false,
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
      await this.props.migrateAll();
      this.setState({
        showMigrationResult: true,
      });
    } catch (err) {
      console.error(err);
    }
  };

  dismissModal = async () => {
    this.setState({ showMigrationResult: false });
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
      migrationResult,
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
        {migrationResult && (
          <MigrationSummary
            visible={this.state.showMigrationResult}
            data={migrationResult}
            onDismiss={this.dismissModal}
          />
        )}
      </Page>
    );
  }
}
export type MigrationSummaryProps = {
  visible: boolean;
  data: ApikeyMigrationResult;
  onDismiss: () => void;
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

export const MigrationSummary: React.FC<MigrationSummaryProps> = ({ visible, data, onDismiss }) => {
  return (
    <Modal title="Migration summary" isOpen={visible} closeOnBackdropClick={true} onDismiss={onDismiss}>
      {data.failedApikeyIDs.length === 0 && (
        <div style={styles.migrationSummary}>
          <p>Migration Successful!</p>
          <p>
            <strong>Total: </strong>
            {data.total}
          </p>
          <p>
            <strong>Migrated: </strong>
            {data.migrated}
          </p>
        </div>
      )}
      {data.failedApikeyIDs.length !== 0 && (
        <div style={styles.migrationSummary}>
          <p>
            Migration Complete! Please note, while there might be a few API keys flagged as `failed migrations`, rest
            assured, all of your API keys are fully functional and operational. Please try again or contact support.
          </p>
          <hr />
          <p>
            <strong>Total: </strong>
            {data.total}
          </p>
          <p>
            <strong>Migrated: </strong>
            {data.migrated}
          </p>
          <p>
            <strong>Failed: </strong>
            {data.failed}
          </p>
          <p>
            <strong>Failed Api Key IDs: </strong>
            {data.failedApikeyIDs.join(', ')}
          </p>
          <p>
            <strong>Failed Details: </strong>
            {data.failedDetails.join(', ')}
          </p>
        </div>
      )}
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss}>
          Close
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

const ApiKeysPage = connector(ApiKeysPageUnconnected);
export default ApiKeysPage;
