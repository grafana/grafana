import React, { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { getTimeZone, NavModelItem } from '@grafana/data';
import { Button, ConfirmModal, HorizontalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
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

interface OwnProps extends GrafanaRouteComponentProps<{ id: string }> {
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
  match,
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

  const serviceAccountId = parseInt(match.params.id, 10);
  const tokenActionsDisabled =
    !contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite) || serviceAccount.isDisabled;

  const ableToWrite = contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);
  const canReadPermissions = contextSrv.hasAccessInMetadata(
    AccessControlAction.ServiceAccountsPermissionsRead,
    serviceAccount!,
    false
  );

  const pageNav: NavModelItem = {
    text: serviceAccount.name,
    img: serviceAccount.avatarUrl,
    subTitle: 'Manage settings for an individual service account.',
  };

  useEffect(() => {
    loadServiceAccount(serviceAccountId);
    loadServiceAccountTokens(serviceAccountId);
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchACOptions();
    }
  }, [loadServiceAccount, loadServiceAccountTokens, serviceAccountId]);

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
    deleteServiceAccount(serviceAccount.id);
  };

  const handleServiceAccountDisable = () => {
    updateServiceAccount({ ...serviceAccount, isDisabled: true });
    setIsDisableModalOpen(false);
  };

  const handleServiceAccountEnable = () => {
    updateServiceAccount({ ...serviceAccount, isDisabled: false });
  };

  const onDeleteServiceAccountToken = (key: ApiKey) => {
    deleteServiceAccountToken(serviceAccount?.id, key.id!);
  };

  const onCreateToken = (token: ServiceAccountToken) => {
    createServiceAccountToken(serviceAccount?.id, token, setNewToken);
  };

  const onTokenModalClose = () => {
    setIsTokenModalOpen(false);
    setNewToken('');
  };

  return (
    <Page navId="serviceaccounts" pageNav={pageNav}>
      <Page.Contents isLoading={isLoading}>
        <div>
          {serviceAccount && (
            <HorizontalGroup spacing="md" height="auto" justify="flex-end">
              <Button
                type={'button'}
                variant="destructive"
                onClick={showDeleteServiceAccountModal(true)}
                disabled={!contextSrv.hasPermission(AccessControlAction.ServiceAccountsDelete)}
              >
                Delete service account
              </Button>
              {serviceAccount.isDisabled ? (
                <Button
                  type={'button'}
                  variant="secondary"
                  onClick={handleServiceAccountEnable}
                  disabled={!ableToWrite}
                >
                  Enable service account
                </Button>
              ) : (
                <Button
                  type={'button'}
                  variant="secondary"
                  onClick={showDisableServiceAccountModal(true)}
                  disabled={!ableToWrite}
                >
                  Disable service account
                </Button>
              )}
            </HorizontalGroup>
          )}
          {serviceAccount && (
            <ServiceAccountProfile serviceAccount={serviceAccount} timeZone={timezone} onChange={onProfileChange} />
          )}
          <HorizontalGroup justify="space-between" height="auto">
            <h3>Tokens</h3>
            <Button onClick={() => setIsTokenModalOpen(true)} disabled={tokenActionsDisabled}>
              Add service account token
            </Button>
          </HorizontalGroup>
          {tokens && (
            <ServiceAccountTokensTable
              tokens={tokens}
              timeZone={timezone}
              onDelete={onDeleteServiceAccountToken}
              tokenActionsDisabled={tokenActionsDisabled}
            />
          )}
          {canReadPermissions && <ServiceAccountPermissions serviceAccount={serviceAccount} />}
        </div>

        <ConfirmModal
          isOpen={isDeleteModalOpen}
          title="Delete service account"
          body="Are you sure you want to delete this service account?"
          confirmText="Delete service account"
          onConfirm={handleServiceAccountDelete}
          onDismiss={showDeleteServiceAccountModal(false)}
        />
        <ConfirmModal
          isOpen={isDisableModalOpen}
          title="Disable service account"
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
