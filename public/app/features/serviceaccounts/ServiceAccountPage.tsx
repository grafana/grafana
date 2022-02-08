import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { ServiceAccountProfile } from './ServiceAccountProfile';
import { StoreState, ServiceAccountDTO, ApiKey } from 'app/types';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { deleteServiceAccountToken, loadServiceAccount, loadServiceAccountTokens } from './state/actions';
import { ServiceAccountTokensTable } from './ServiceAccountTokensTable';
import { getTimeZone, NavModel } from '@grafana/data';

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
  deleteServiceAccountToken,
}: Props) => {
  useEffect(() => {
    const serviceAccountId = parseInt(match.params.id, 10);
    loadServiceAccount(serviceAccountId);
    loadServiceAccountTokens(serviceAccountId);
  }, [match, loadServiceAccount, loadServiceAccountTokens]);

  const onDeleteServiceAccountToken = (key: ApiKey) => {
    deleteServiceAccountToken(parseInt(match.params.id, 10), key.id!);
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
        <h3 className="page-heading">Tokens</h3>
        {tokens && (
          <ServiceAccountTokensTable tokens={tokens} timeZone={timezone} onDelete={onDeleteServiceAccountToken} />
        )}
      </Page.Contents>
    </Page>
  );
};

export const ServiceAccountPage = connector(ServiceAccountPageUnconnected);
