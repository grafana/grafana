import { useEffect, useState } from 'react';

import { getTimeZone } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { ApiKey } from 'app/types/apiKeys';
import { ServiceAccountDTO } from 'app/types/serviceaccount';
import { useDispatch, useSelector } from 'app/types/store';

import { CreateTokenModal, ServiceAccountToken } from './components/CreateTokenModal';
import { ServiceAccountTokensTable } from './components/ServiceAccountTokensTable';
import {
  createServiceAccountToken,
  deleteServiceAccountToken,
  loadServiceAccountTokens,
} from './state/actionsServiceAccountPage';

interface Props {
  serviceAccount: ServiceAccountDTO;
}

export const ServiceAccountTokensPage = ({ serviceAccount }: Props) => {
  const dispatch = useDispatch();
  const timezone = useSelector((state) => getTimeZone(state.user));
  const tokens = useSelector((state) => state.serviceAccountProfile.tokens);
  const [newToken, setNewToken] = useState('');
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

  const tokenActionsDisabled =
    serviceAccount.isDisabled ||
    serviceAccount.isExternal ||
    !contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite);

  useEffect(() => {
    dispatch(loadServiceAccountTokens(serviceAccount.uid));
  }, [dispatch, serviceAccount.uid]);

  const onDeleteServiceAccountToken = (key: ApiKey) => {
    dispatch(deleteServiceAccountToken(serviceAccount.uid, key.id!));
  };

  const onCreateToken = (token: ServiceAccountToken) => {
    dispatch(createServiceAccountToken(serviceAccount.uid, token, setNewToken));
  };

  const onTokenModalClose = () => {
    setIsTokenModalOpen(false);
    setNewToken('');
  };

  return (
    <div>
      <h3>
        <Trans i18nKey="serviceaccounts.tokens-page.tokens">Tokens</Trans>
      </h3>
      {tokens && (
        <ServiceAccountTokensTable
          tokens={tokens}
          timeZone={timezone}
          onDelete={onDeleteServiceAccountToken}
          tokenActionsDisabled={tokenActionsDisabled}
        />
      )}
      {!serviceAccount.isExternal && (
        <Button
          onClick={() => setIsTokenModalOpen(true)}
          disabled={tokenActionsDisabled}
          key="add-service-account-token"
          icon="plus"
        >
          <Trans i18nKey="serviceaccounts.tokens-page.add-service-account-token">Add service account token</Trans>
        </Button>
      )}

      <CreateTokenModal
        isOpen={isTokenModalOpen}
        token={newToken}
        serviceAccountLogin={serviceAccount.login}
        onCreateToken={onCreateToken}
        onClose={onTokenModalClose}
      />
    </div>
  );
};
