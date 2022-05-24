import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { connect, ConnectedProps, useDispatch } from 'react-redux';

import { getTimeZone, GrafanaTheme2, NavModel } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { AccessControlAction, ApiKey, Role, ServiceAccountDTO, StoreState } from 'app/types';

import { ServiceAccountProfile } from './ServiceAccountProfile';
import { CreateTokenModal, ServiceAccountToken } from './components/CreateTokenModal';
import { ServiceAccountTokensTable } from './components/ServiceAccountTokensTable';
import { fetchACOptions } from './state/actions';
import {
  createServiceAccountToken,
  deleteServiceAccountToken,
  loadServiceAccount,
  loadServiceAccountTokens,
} from './state/actionsServiceAccountPage';

interface OwnProps extends GrafanaRouteComponentProps<{ id: string }> {
  navModel: NavModel;
  serviceAccount?: ServiceAccountDTO;
  tokens: ApiKey[];
  isLoading: boolean;
  roleOptions: Role[];
  builtInRoles: Record<string, Role[]>;
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'serviceaccounts'),
    serviceAccount: state.serviceAccountProfile.serviceAccount,
    tokens: state.serviceAccountProfile.tokens,
    isLoading: state.serviceAccountProfile.isLoading,
    roleOptions: state.serviceAccounts.roleOptions,
    builtInRoles: state.serviceAccounts.builtInRoles,
    timezone: getTimeZone(state.user),
  };
}

const connector = connect(mapStateToProps);
type Props = OwnProps & ConnectedProps<typeof connector>;

const ServiceAccountPageUnconnected = ({
  navModel,
  match,
  serviceAccount,
  tokens,
  timezone,
  isLoading,
  roleOptions,
  builtInRoles,
}: Props): JSX.Element => {
  const dispatch = useDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newToken, setNewToken] = useState('');
  const styles = useStyles2(getStyles);
  const serviceAccountId = parseInt(match.params.id, 10);
  const tokenActionsDisabled =
    !contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite) || serviceAccount.isDisabled;

  useEffect(() => {
    dispatch(loadServiceAccount(serviceAccountId));
    dispatch(loadServiceAccountTokens(serviceAccountId));
    if (contextSrv.licensedAccessControlEnabled()) {
      dispatch(fetchACOptions());
    }
  }, [match, dispatch, serviceAccountId]);

  const onDeleteServiceAccountToken = (key: ApiKey) => {
    dispatch(deleteServiceAccountToken(serviceAccount?.id, key.id!));
  };

  const onCreateToken = (token: ServiceAccountToken) => {
    dispatch(createServiceAccountToken(serviceAccount?.id, token, setNewToken));
  };

  const onModalClose = () => {
    setIsModalOpen(false);
    setNewToken('');
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={isLoading}>
        {serviceAccount && (
          <>
            <ServiceAccountProfile
              serviceAccount={serviceAccount}
              timeZone={timezone}
              roleOptions={roleOptions}
              builtInRoles={builtInRoles}
            />
          </>
        )}
        <div className={styles.tokensListHeader}>
          <h4>Tokens</h4>
          <Button onClick={() => setIsModalOpen(true)} disabled={tokenActionsDisabled}>
            Add service account token
          </Button>
        </div>
        {tokens && (
          <ServiceAccountTokensTable
            tokens={tokens}
            timeZone={timezone}
            onDelete={onDeleteServiceAccountToken}
            tokenActionsDisabled={tokenActionsDisabled}
          />
        )}
        <CreateTokenModal isOpen={isModalOpen} token={newToken} onCreateToken={onCreateToken} onClose={onModalClose} />
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tokensListHeader: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
    `,
  };
};

export const ServiceAccountPage = connector(ServiceAccountPageUnconnected);
