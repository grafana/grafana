import { useEffect, useState } from 'react';
import { ConnectedProps, connect } from 'react-redux';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem, getTimeZone } from '@grafana/data';
import { Button, ConfirmModal, IconButton, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { Trans, t } from 'app/core/internationalization';
import { AccessControlAction, ApiKey, ServiceAccountDTO, StoreState } from 'app/types';

import { ServiceAccountPermissions } from './ServiceAccountPermissions';
import { CreateTokenModal, ServiceAccountToken } from './components/CreateTokenModal';
import { ServiceAccountProfile } from './components/ServiceAccountProfile';
import { ServiceAccountTokensTable } from './components/ServiceAccountTokensTable';
import { fetchACOptions } from './state/actions';
import {
  createServiceAccountToken,
  deleteServiceAccount,
  deleteServiceAccountToken,
  loadServiceAccount,
  loadServiceAccountTokens,
  updateServiceAccount,
} from './state/actionsServiceAccountPage';

interface OwnProps {
  serviceAccount?: ServiceAccountDTO;
  tokens: ApiKey[];
  isLoading: boolean;
}

function mapStateToProps(state: StoreState) {
  return {
    serviceAccount: state.serviceAccountProfile.serviceAccount,
    tokens: state.serviceAccountProfile.tokens,
    isLoading: state.serviceAccountProfile.isLoading,
    timezone: getTimeZone(state.user),
  };
}

const mapDispatchToProps = {
  createServiceAccountToken,
  deleteServiceAccount,
  deleteServiceAccountToken,
  loadServiceAccount,
  loadServiceAccountTokens,
  updateServiceAccount,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export const ServiceAccountPageUnconnected = ({
  serviceAccount,
  tokens,
  timezone,
  isLoading,
  createServiceAccountToken,
  deleteServiceAccount,
  deleteServiceAccountToken,
  loadServiceAccount,
  loadServiceAccountTokens,
  updateServiceAccount,
}: Props): JSX.Element => {
  const [newToken, setNewToken] = useState('');
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const { id = '' } = useParams();

  const tokenActionsDisabled =
    serviceAccount.isDisabled ||
    serviceAccount.isExternal ||
    !contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);

  const ableToWrite = contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);
  const canReadPermissions = contextSrv.hasPermissionInMetadata(
    AccessControlAction.ServiceAccountsPermissionsRead,
    serviceAccount!
  );

  const pageNav: NavModelItem = {
    text: serviceAccount.name,
    img: serviceAccount.avatarUrl,
    subTitle: 'Manage settings for an individual service account.',
  };

  useEffect(() => {
    loadServiceAccount(id);
    loadServiceAccountTokens(id);
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchACOptions();
    }
  }, [loadServiceAccount, loadServiceAccountTokens, id]);

  const onProfileChange = (serviceAccount: ServiceAccountDTO) => {
    updateServiceAccount(serviceAccount);
  };

  const showDeleteServiceAccountModal = (show: boolean) => () => {
    setIsDeleteModalOpen(show);
  };

  const showDisableServiceAccountModal = (show: boolean) => () => {
    setIsDisableModalOpen(show);
  };

  const handleServiceAccountDelete = () => {
    deleteServiceAccount(serviceAccount.uid);
  };

  const handleServiceAccountDisable = () => {
    updateServiceAccount({ ...serviceAccount, isDisabled: true });
    setIsDisableModalOpen(false);
  };

  const handleServiceAccountEnable = () => {
    updateServiceAccount({ ...serviceAccount, isDisabled: false });
  };

  const onDeleteServiceAccountToken = (key: ApiKey) => {
    deleteServiceAccountToken(serviceAccount?.uid, key.id!);
  };

  const onCreateToken = (token: ServiceAccountToken) => {
    createServiceAccountToken(serviceAccount?.uid, token, setNewToken);
  };

  const onTokenModalClose = () => {
    setIsTokenModalOpen(false);
    setNewToken('');
  };

  return (
    <Page navId="serviceaccounts" pageNav={pageNav}>
      <Page.Contents isLoading={isLoading}>
        <div>
          {serviceAccount && !serviceAccount.isExternal && (
            <Stack gap={2} height="auto" justifyContent="flex-end">
              <Button
                type={'button'}
                variant="destructive"
                onClick={showDeleteServiceAccountModal(true)}
                disabled={!contextSrv.hasPermission(AccessControlAction.ServiceAccountsDelete)}
              >
                <Trans i18nKey="serviceaccounts.service-account-page-unconnected.delete-service-account">
                  Delete service account
                </Trans>
              </Button>
              {serviceAccount.isDisabled ? (
                <Button
                  type={'button'}
                  variant="secondary"
                  onClick={handleServiceAccountEnable}
                  disabled={!ableToWrite}
                >
                  <Trans i18nKey="serviceaccounts.service-account-page-unconnected.enable-service-account">
                    Enable service account
                  </Trans>
                </Button>
              ) : (
                <Button
                  type={'button'}
                  variant="secondary"
                  onClick={showDisableServiceAccountModal(true)}
                  disabled={!ableToWrite}
                >
                  <Trans i18nKey="serviceaccounts.service-account-page-unconnected.disable-service-account">
                    Disable service account
                  </Trans>
                </Button>
              )}
            </Stack>
          )}
          {serviceAccount && serviceAccount.isExternal && (
            <Stack gap={2} height="auto" justifyContent="flex-end">
              <IconButton
                disabled={true}
                name="lock"
                size="md"
                tooltip={t(
                  'serviceaccounts.service-account-page-unconnected.tooltip-managed-service-account-cannot-modified',
                  'This is a managed service account and cannot be modified'
                )}
              />
            </Stack>
          )}
          {serviceAccount && (
            <ServiceAccountProfile serviceAccount={serviceAccount} timeZone={timezone} onChange={onProfileChange} />
          )}
          <Stack justifyContent="space-between" height="auto">
            <h3>
              <Trans i18nKey="serviceaccounts.service-account-page-unconnected.tokens">Tokens</Trans>
            </h3>
            {!serviceAccount.isExternal && (
              <Button
                onClick={() => setIsTokenModalOpen(true)}
                disabled={tokenActionsDisabled}
                key="add-service-account-token"
                icon="plus"
              >
                <Trans i18nKey="serviceaccounts.service-account-page-unconnected.add-service-account-token">
                  Add service account token
                </Trans>
              </Button>
            )}
          </Stack>
          {tokens && (
            <ServiceAccountTokensTable
              tokens={tokens}
              timeZone={timezone}
              onDelete={onDeleteServiceAccountToken}
              tokenActionsDisabled={tokenActionsDisabled}
            />
          )}
          {!serviceAccount.isExternal && canReadPermissions && (
            <ServiceAccountPermissions serviceAccount={serviceAccount} />
          )}
        </div>

        <ConfirmModal
          isOpen={isDeleteModalOpen}
          title={t(
            'serviceaccounts.service-account-page-unconnected.title-delete-service-account',
            'Delete service account'
          )}
          body="Are you sure you want to delete this service account?"
          confirmText="Delete service account"
          onConfirm={handleServiceAccountDelete}
          onDismiss={showDeleteServiceAccountModal(false)}
        />
        <ConfirmModal
          isOpen={isDisableModalOpen}
          title={t(
            'serviceaccounts.service-account-page-unconnected.title-disable-service-account',
            'Disable service account'
          )}
          body="Are you sure you want to disable this service account?"
          confirmText="Disable service account"
          onConfirm={handleServiceAccountDisable}
          onDismiss={showDisableServiceAccountModal(false)}
        />
        <CreateTokenModal
          isOpen={isTokenModalOpen}
          token={newToken}
          serviceAccountLogin={serviceAccount.login}
          onCreateToken={onCreateToken}
          onClose={onTokenModalClose}
        />
      </Page.Contents>
    </Page>
  );
};

export default connector(ServiceAccountPageUnconnected);
