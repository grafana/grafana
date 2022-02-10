import React, { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { ServiceAccountProfile } from './ServiceAccountProfile';
import { StoreState, ServiceAccountDTO, ApiKey } from 'app/types';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import {
  deleteServiceAccountToken,
  loadServiceAccount,
  loadServiceAccountTokens,
  createServiceAccountToken,
} from './state/actions';
import { ServiceAccountTokensTable } from './ServiceAccountTokensTable';
import { getTimeZone, NavModel, OrgRole } from '@grafana/data';
import { Button, VerticalGroup } from '@grafana/ui';
import { CreateTokenModal } from './CreateTokenModal';

interface OwnProps extends GrafanaRouteComponentProps<{ id: string }> {
  navModel: NavModel;
  serviceAccount?: ServiceAccountDTO;
  tokens: ApiKey[];
  isLoading: boolean;
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'serviceaccounts'),
    serviceAccount: state.serviceAccountProfile.serviceAccount,
    tokens: state.serviceAccountProfile.tokens,
    isLoading: state.serviceAccountProfile.isLoading,
    timezone: getTimeZone(state.user),
  };
}
const mapDispatchToProps = {
  loadServiceAccount,
  loadServiceAccountTokens,
  createServiceAccountToken,
  deleteServiceAccountToken,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = OwnProps & ConnectedProps<typeof connector>;

const ServiceAccountPageUnconnected = ({
  navModel,
  match,
  serviceAccount,
  tokens,
  timezone,
  isLoading,
  loadServiceAccount,
  loadServiceAccountTokens,
  createServiceAccountToken,
  deleteServiceAccountToken,
}: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newToken, setNewToken] = useState('');

  useEffect(() => {
    const serviceAccountId = parseInt(match.params.id, 10);
    loadServiceAccount(serviceAccountId);
    loadServiceAccountTokens(serviceAccountId);
  }, [match, loadServiceAccount, loadServiceAccountTokens]);

  const onDeleteServiceAccountToken = (key: ApiKey) => {
    deleteServiceAccountToken(parseInt(match.params.id, 10), key.id!);
  };

  const onCreateToken = (name: string) => {
    createServiceAccountToken(
      serviceAccount.id,
      {
        name,
        role: OrgRole.Viewer,
      },
      setNewToken
    );
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
              serviceaccount={serviceAccount}
              onServiceAccountDelete={() => {
                console.log(`not implemented`);
              }}
              onServiceAccountUpdate={() => {
                console.log(`not implemented`);
              }}
              onServiceAccountDisable={() => {
                console.log(`not implemented`);
              }}
              onServiceAccountEnable={() => {
                console.log(`not implemented`);
              }}
            />
          </>
        )}
        <VerticalGroup spacing="md">
          <Button onClick={() => setIsModalOpen(true)}>Add token</Button>
          <h3 className="page-heading">Tokens</h3>
          {tokens && (
            <ServiceAccountTokensTable tokens={tokens} timeZone={timezone} onDelete={onDeleteServiceAccountToken} />
          )}
        </VerticalGroup>
        <CreateTokenModal isOpen={isModalOpen} token={newToken} onCreateToken={onCreateToken} onClose={onModalClose} />
      </Page.Contents>
    </Page>
  );
};

export const ServiceAccountPage = connector(ServiceAccountPageUnconnected);
