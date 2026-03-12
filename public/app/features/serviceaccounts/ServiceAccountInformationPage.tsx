import { useState } from 'react';

import { getTimeZone } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ConfirmModal, IconButton, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { ServiceAccountDTO } from 'app/types/serviceaccount';
import { useDispatch, useSelector } from 'app/types/store';

import { ServiceAccountProfile } from './components/ServiceAccountProfile';
import { deleteServiceAccount, updateServiceAccount } from './state/actionsServiceAccountPage';

interface Props {
  serviceAccount: ServiceAccountDTO;
}

export const ServiceAccountInformationPage = ({ serviceAccount }: Props) => {
  const dispatch = useDispatch();
  const timezone = useSelector((state) => getTimeZone(state.user));
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);

  const ableToWrite = contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);

  const onProfileChange = (updatedServiceAccount: ServiceAccountDTO) => {
    dispatch(updateServiceAccount(updatedServiceAccount));
  };

  const showDeleteServiceAccountModal = (show: boolean) => () => {
    setIsDeleteModalOpen(show);
  };

  const showDisableServiceAccountModal = (show: boolean) => () => {
    setIsDisableModalOpen(show);
  };

  const handleServiceAccountDelete = () => {
    dispatch(deleteServiceAccount(serviceAccount.uid));
  };

  const handleServiceAccountDisable = () => {
    dispatch(updateServiceAccount({ ...serviceAccount, isDisabled: true }));
    setIsDisableModalOpen(false);
  };

  const handleServiceAccountEnable = () => {
    dispatch(updateServiceAccount({ ...serviceAccount, isDisabled: false }));
  };

  return (
    <div>
      {serviceAccount && (
        <ServiceAccountProfile serviceAccount={serviceAccount} timeZone={timezone} onChange={onProfileChange} />
      )}
      {serviceAccount && !serviceAccount.isExternal && (
        <Stack gap={2} height="auto">
          <Button
            type={'button'}
            variant="destructive"
            onClick={showDeleteServiceAccountModal(true)}
            disabled={!contextSrv.hasPermission(AccessControlAction.ServiceAccountsDelete)}
          >
            <Trans i18nKey="serviceaccounts.information-page.delete-service-account">
              Delete service account
            </Trans>
          </Button>
          {serviceAccount.isDisabled ? (
            <Button type={'button'} variant="secondary" onClick={handleServiceAccountEnable} disabled={!ableToWrite}>
              <Trans i18nKey="serviceaccounts.information-page.enable-service-account">
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
              <Trans i18nKey="serviceaccounts.information-page.disable-service-account">
                Disable service account
              </Trans>
            </Button>
          )}
        </Stack>
      )}
      {serviceAccount && serviceAccount.isExternal && (
        <Stack gap={2} height="auto">
          <IconButton
            disabled={true}
            name="lock"
            size="md"
            tooltip={t(
              'serviceaccounts.information-page.tooltip-managed-service-account',
              'This is a managed service account and cannot be modified'
            )}
          />
        </Stack>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title={t('serviceaccounts.information-page.title-delete-service-account', 'Delete service account')}
        body={t(
          'serviceaccounts.information-page.body-delete-service-account',
          'Are you sure you want to delete this service account?'
        )}
        confirmText={t('serviceaccounts.information-page.confirmText-delete-service-account', 'Delete service account')}
        onConfirm={handleServiceAccountDelete}
        onDismiss={showDeleteServiceAccountModal(false)}
      />
      <ConfirmModal
        isOpen={isDisableModalOpen}
        title={t('serviceaccounts.information-page.title-disable-service-account', 'Disable service account')}
        body={t(
          'serviceaccounts.information-page.body-disable-service-account',
          'Are you sure you want to disable this service account?'
        )}
        confirmText={t(
          'serviceaccounts.information-page.confirmText-disable-service-account',
          'Disable service account'
        )}
        onConfirm={handleServiceAccountDisable}
        onDismiss={showDisableServiceAccountModal(false)}
      />
    </div>
  );
};
