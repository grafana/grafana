import { PureComponent } from 'react';
import * as React from 'react';
import { connect, ConnectedProps } from 'react-redux';

// Utils
import { InlineField, InlineSwitch, Modal, Button, EmptyState } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { t, Trans } from 'app/core/internationalization';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { AccessControlAction, ApiKey, ApikeyMigrationResult, StoreState } from 'app/types';

import { ApiKeysActionBar } from './ApiKeysActionBar';
import { ApiKeysTable } from './ApiKeysTable';
import { MigrateToServiceAccountsCard } from './MigrateToServiceAccountsCard';
import { deleteApiKey, migrateApiKey, migrateAll, loadApiKeys, toggleIncludeExpired } from './state/actions';
import { setSearchQuery } from './state/reducers';
import { getApiKeys, getApiKeysCount, getIncludeExpired, getIncludeExpiredDisabled } from './state/selectors';

function mapStateToProps(state: StoreState) {
  const canCreate = contextSrv.hasPermission(AccessControlAction.ActionAPIKeysCreate);
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

    const showTable = apiKeysCount > 0;
    return (
      <Page {...defaultPageProps}>
        <Page.Contents isLoading={!hasFetched}>
          <MigrateToServiceAccountsCard onMigrate={this.onMigrateApiKeys} apikeysCount={apiKeysCount} />
          {showTable ? (
            <ApiKeysActionBar
              searchQuery={searchQuery}
              disabled={!canCreate}
              onSearchChange={this.onSearchQueryChange}
            />
          ) : null}
          <InlineField
            disabled={includeExpiredDisabled}
            label={t('api-keys.api-keys-page-unconnected.label-include-expired-keys', 'Include expired keys')}
          >
            <InlineSwitch id="showExpired" value={includeExpired} onChange={this.onIncludeExpiredChange} />
          </InlineField>
          {apiKeys.length > 0 ? (
            <ApiKeysTable
              apiKeys={apiKeys}
              timeZone={timeZone}
              onMigrate={this.onMigrateApiKey}
              onDelete={this.onDeleteApiKey}
            />
          ) : (
            <EmptyState variant="not-found" message={t('api-keys.empty-state.message', 'No API keys found')} />
          )}
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
    <Modal
      title={t('api-keys.migration-summary.title-migration-summary', 'Migration summary')}
      isOpen={visible}
      closeOnBackdropClick={true}
      onDismiss={onDismiss}
    >
      {data.failedApikeyIDs.length === 0 && (
        <div style={styles.migrationSummary}>
          <p>
            <Trans i18nKey="api-keys.migration-summary.migration-successful">Migration Successful!</Trans>
          </p>
          <p>
            <Trans i18nKey="api-keys.migration-summary.total" values={{ total: data.total }}>
              <strong>Total: </strong>
              {'{{total}}'}
            </Trans>
          </p>
          <p>
            <Trans i18nKey="api-keys.migration-summary.migrated" values={{ migrated: data.migrated }}>
              <strong>Migrated: </strong>
              {'{{migrated}}'}
            </Trans>
          </p>
        </div>
      )}
      {data.failedApikeyIDs.length !== 0 && (
        <div style={styles.migrationSummary}>
          <p>
            <Trans i18nKey="api-keys.migration-summary.migration-complete">
              Migration complete! Please note, while there might be a few API keys flagged as `failed migrations`, rest
              assured, all of your API keys are fully functional and operational. Please try again or contact support.
            </Trans>
          </p>
          <hr />
          <p>
            <Trans i18nKey="api-keys.migration-summary.total" values={{ total: data.total }}>
              <strong>Total: </strong>
              {'{{total}}'}
            </Trans>
          </p>
          <p>
            <Trans i18nKey="api-keys.migration-summary.migrated" values={{ migrated: data.migrated }}>
              <strong>Migrated: </strong>
              {'{{migrated}}'}
            </Trans>
          </p>
          <p>
            <Trans i18nKey="api-keys.migration-summary.failed" values={{ failed: data.failed }}>
              <strong>Failed: </strong>
              {'{{failed}}'}
            </Trans>
          </p>
          <p>
            <Trans i18nKey="api-keys.migration-summary.failed-ids" values={{ ids: data.failedApikeyIDs.join(', ') }}>
              <strong>Failed api key IDs: </strong>
              {'{{ids}}'}
            </Trans>
          </p>
          <p>
            <Trans
              i18nKey="api-keys.migration-summary.failed-details"
              values={{ details: data.failedDetails.join(', ') }}
            >
              <strong>Failed details: </strong>
              {'{{details}}'}
            </Trans>
          </p>
        </div>
      )}
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss}>
          <Trans i18nKey="api-keys.migration-summary.close">Close</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

const ApiKeysPage = connector(ApiKeysPageUnconnected);
export default ApiKeysPage;
