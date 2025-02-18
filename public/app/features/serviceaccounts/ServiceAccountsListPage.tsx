import pluralize from 'pluralize';
import { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { OrgRole } from '@grafana/data';
import { ConfirmModal, FilterInput, LinkButton, RadioButtonGroup, InlineField, EmptyState, Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { Trans, t } from 'app/core/internationalization';
import { StoreState, ServiceAccountDTO, AccessControlAction, ServiceAccountStateFilter } from 'app/types';

import { ServiceAccountTable } from './ServiceAccountTable';
import { CreateTokenModal, ServiceAccountToken } from './components/CreateTokenModal';
import {
  changeQuery,
  changePage,
  fetchACOptions,
  fetchServiceAccounts,
  deleteServiceAccount,
  updateServiceAccount,
  changeStateFilter,
  createServiceAccountToken,
} from './state/actions';

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    ...state.serviceAccounts,
  };
}

const mapDispatchToProps = {
  changePage,
  changeQuery,
  fetchACOptions,
  fetchServiceAccounts,
  deleteServiceAccount,
  updateServiceAccount,
  changeStateFilter,
  createServiceAccountToken,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

const availableFilters = [
  { label: 'All', value: ServiceAccountStateFilter.All },
  { label: 'With expired tokens', value: ServiceAccountStateFilter.WithExpiredTokens },
  { label: 'Disabled', value: ServiceAccountStateFilter.Disabled },
];

if (config.featureToggles.externalServiceAccounts) {
  availableFilters.push({ label: 'Managed', value: ServiceAccountStateFilter.External });
}

export const ServiceAccountsListPageUnconnected = ({
  page,
  changePage,
  totalPages,
  serviceAccounts,
  isLoading,
  roleOptions,
  query,
  serviceAccountStateFilter,
  changeQuery,
  fetchACOptions,
  fetchServiceAccounts,
  deleteServiceAccount,
  updateServiceAccount,
  changeStateFilter,
  createServiceAccountToken,
}: Props): JSX.Element => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [currentServiceAccount, setCurrentServiceAccount] = useState<ServiceAccountDTO | null>(null);

  useEffect(() => {
    fetchServiceAccounts({ withLoadingIndicator: true });
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchACOptions();
    }
  }, [fetchACOptions, fetchServiceAccounts]);

  const noServiceAccountsCreated =
    serviceAccounts.length === 0 && serviceAccountStateFilter === ServiceAccountStateFilter.All && !query;

  const onRoleChange = async (role: OrgRole, serviceAccount: ServiceAccountDTO) => {
    const updatedServiceAccount = { ...serviceAccount, role: role };
    updateServiceAccount(updatedServiceAccount);
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchACOptions();
    }
  };

  const onQueryChange = (value: string) => {
    changeQuery(value);
  };

  const onStateFilterChange = (value: ServiceAccountStateFilter) => {
    changeStateFilter(value);
  };

  const onRemoveButtonClick = (serviceAccount: ServiceAccountDTO) => {
    setCurrentServiceAccount(serviceAccount);
    setIsRemoveModalOpen(true);
  };

  const onServiceAccountRemove = async () => {
    if (currentServiceAccount) {
      deleteServiceAccount(currentServiceAccount.uid);
    }
    onRemoveModalClose();
  };

  const onDisableButtonClick = (serviceAccount: ServiceAccountDTO) => {
    setCurrentServiceAccount(serviceAccount);
    setIsDisableModalOpen(true);
  };

  const onDisable = () => {
    if (currentServiceAccount) {
      updateServiceAccount({ ...currentServiceAccount, isDisabled: true });
    }
    onDisableModalClose();
  };

  const onEnable = (serviceAccount: ServiceAccountDTO) => {
    updateServiceAccount({ ...serviceAccount, isDisabled: false });
  };

  const onTokenAdd = (serviceAccount: ServiceAccountDTO) => {
    setCurrentServiceAccount(serviceAccount);
    setIsAddModalOpen(true);
  };

  const onTokenCreate = async (token: ServiceAccountToken) => {
    if (currentServiceAccount) {
      createServiceAccountToken(currentServiceAccount.uid, token, setNewToken);
    }
  };

  const onAddModalClose = () => {
    setIsAddModalOpen(false);
    setCurrentServiceAccount(null);
    setNewToken('');
  };

  const onRemoveModalClose = () => {
    setIsRemoveModalOpen(false);
    setCurrentServiceAccount(null);
  };

  const onDisableModalClose = () => {
    setIsDisableModalOpen(false);
    setCurrentServiceAccount(null);
  };

  const docsLink = (
    <a
      className="external-link"
      href="https://grafana.com/docs/grafana/latest/administration/service-accounts/"
      target="_blank"
      rel="noopener noreferrer"
    >
      documentation.
    </a>
  );
  const subTitle = (
    <span>
      Service accounts and their tokens can be used to authenticate against the Grafana API. Find out more in our{' '}
      {docsLink}
    </span>
  );

  return (
    <Page
      navId="serviceaccounts"
      subTitle={subTitle}
      actions={
        <>
          {!noServiceAccountsCreated && contextSrv.hasPermission(AccessControlAction.ServiceAccountsCreate) && (
            <LinkButton href="org/serviceaccounts/create" variant="primary">
              Add service account
            </LinkButton>
          )}
        </>
      }
    >
      <Page.Contents>
        <div className="page-action-bar">
          <InlineField grow>
            <FilterInput
              placeholder="Search service account by name"
              value={query}
              onChange={onQueryChange}
              width={50}
            />
          </InlineField>
          <Box marginBottom={1}>
            <RadioButtonGroup
              options={availableFilters}
              onChange={onStateFilterChange}
              value={serviceAccountStateFilter}
            />
          </Box>
        </div>
        {!isLoading && !noServiceAccountsCreated && serviceAccounts.length === 0 && (
          <EmptyState
            variant="not-found"
            message={t('service-accounts.empty-state.message', 'No services accounts found')}
          />
        )}
        {!isLoading && noServiceAccountsCreated && (
          <EmptyState
            variant="call-to-action"
            button={
              <LinkButton
                disabled={!contextSrv.hasPermission(AccessControlAction.ServiceAccountsCreate)}
                href="org/serviceaccounts/create"
                icon="key-skeleton-alt"
                size="lg"
              >
                <Trans i18nKey="service-accounts.empty-state.button-title">Add service account</Trans>
              </LinkButton>
            }
            message={t('service-accounts.empty-state.title', "You haven't created any service accounts yet")}
          >
            <Trans i18nKey="service-accounts.empty-state.more-info">
              Remember, you can provide specific permissions for API access to other applications
            </Trans>
          </EmptyState>
        )}

        {(isLoading || serviceAccounts.length !== 0) && (
          <ServiceAccountTable
            services={serviceAccounts}
            showPaging={true}
            totalPages={totalPages}
            onChangePage={changePage}
            currentPage={page}
            onRoleChange={onRoleChange}
            roleOptions={roleOptions}
            onRemoveButtonClick={onRemoveButtonClick}
            onDisable={onDisableButtonClick}
            onEnable={onEnable}
            onAddTokenClick={onTokenAdd}
            isLoading={isLoading}
          />
        )}
        {currentServiceAccount && (
          <>
            <ConfirmModal
              isOpen={isRemoveModalOpen}
              body={`Are you sure you want to delete '${currentServiceAccount.name}'${
                !!currentServiceAccount.tokens
                  ? ` and ${currentServiceAccount.tokens} accompanying ${pluralize(
                      'token',
                      currentServiceAccount.tokens
                    )}`
                  : ''
              }?`}
              confirmText="Delete"
              title="Delete service account"
              onConfirm={onServiceAccountRemove}
              onDismiss={onRemoveModalClose}
            />
            <ConfirmModal
              isOpen={isDisableModalOpen}
              title="Disable service account"
              body={`Are you sure you want to disable '${currentServiceAccount.name}'?`}
              confirmText="Disable service account"
              onConfirm={onDisable}
              onDismiss={onDisableModalClose}
            />
            <CreateTokenModal
              isOpen={isAddModalOpen}
              token={newToken}
              serviceAccountLogin={currentServiceAccount.login}
              onCreateToken={onTokenCreate}
              onClose={onAddModalClose}
            />
          </>
        )}
      </Page.Contents>
    </Page>
  );
};

const ServiceAccountsListPage = connector(ServiceAccountsListPageUnconnected);
export default ServiceAccountsListPage;
