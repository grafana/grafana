import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  ConfirmModal,
  FilterInput,
  LinkButton,
  RadioButtonGroup,
  InlineField,
  EmptyState,
  Box,
  Stack,
  useStyles2,
  TextLink,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
import { ServiceAccountStateFilter, ServiceAccountDTO } from 'app/types/serviceaccount';
import { StoreState } from 'app/types/store';

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
  const styles = useStyles2(getStyles);

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

  const subTitle = (
    <span>
      <Trans i18nKey="serviceaccounts.service-accounts-list-page-unconnected.sub-title">
        Service accounts and their tokens can be used to authenticate against the Grafana API. Find out more in our{' '}
        <TextLink href="https://grafana.com/docs/grafana/latest/administration/service-accounts/" external>
          documentation.
        </TextLink>
      </Trans>
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
              <Trans i18nKey="serviceaccounts.service-accounts-list-page-unconnected.add-service-account">
                Add service account
              </Trans>
            </LinkButton>
          )}
        </>
      }
    >
      <Page.Contents>
        <Stack justifyContent="space-between" wrap="wrap">
          <InlineField grow>
            <FilterInput
              className={styles.filterInput}
              placeholder={t(
                'serviceaccounts.service-accounts-list-page-unconnected.placeholder-search-service-account-by-name',
                'Search service account by name'
              )}
              value={query}
              onChange={onQueryChange}
            />
          </InlineField>
          <Box marginBottom={1}>
            <RadioButtonGroup
              options={availableFilters}
              onChange={onStateFilterChange}
              value={serviceAccountStateFilter}
            />
          </Box>
        </Stack>
        {!isLoading && !noServiceAccountsCreated && serviceAccounts.length === 0 && (
          <EmptyState
            variant="not-found"
            message={t('service-accounts.empty-state.message', 'No service accounts found')}
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
              body={
                !!currentServiceAccount.tokens
                  ? t(
                      'serviceaccounts.service-accounts-list-page-unconnected.body-delete',
                      'Are you sure you want to delete {{serviceAccountName}} and {{count}} accompanying tokens?',
                      {
                        serviceAccountName: currentServiceAccount.name,
                        count: currentServiceAccount.tokens,
                      }
                    )
                  : t(
                      'serviceaccounts.service-accounts-list-page-unconnected.body-delete-with-tokens',
                      'Are you sure you want to delete {{serviceAccountName}}?',
                      {
                        serviceAccountName: currentServiceAccount.name,
                      }
                    )
              }
              confirmText={t('serviceaccounts.service-accounts-list-page-unconnected.confirmText-delete', 'Delete')}
              title={t(
                'serviceaccounts.service-accounts-list-page-unconnected.title-delete-service-account',
                'Delete service account'
              )}
              onConfirm={onServiceAccountRemove}
              onDismiss={onRemoveModalClose}
            />
            <ConfirmModal
              isOpen={isDisableModalOpen}
              title={t(
                'serviceaccounts.service-accounts-list-page-unconnected.title-disable-service-account',
                'Disable service account'
              )}
              body={t(
                'serviceaccounts.service-accounts-list-page-unconnected.body-disable-service-account',
                "Are you sure you want to disable '{{accountToDisable}}'?",
                { accountToDisable: currentServiceAccount.name }
              )}
              confirmText={t(
                'serviceaccounts.service-accounts-list-page-unconnected.confirmText-disable-service-account',
                'Disable service account'
              )}
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

const getStyles = (theme: GrafanaTheme2) => ({
  filterInput: css({
    maxWidth: theme.spacing(50),
  }),
});

const ServiceAccountsListPage = connector(ServiceAccountsListPageUnconnected);
export default ServiceAccountsListPage;
