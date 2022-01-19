import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { ServiceAccountProfile } from './ServiceAccountProfile';
import { StoreState, ServiceAccountDTO } from 'app/types';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { loadServiceAccount } from './state/actions';

interface OwnProps extends GrafanaRouteComponentProps<{ id: string }> {
  navModel: NavModel;
  serviceAccount?: ServiceAccountDTO;
  isLoading: boolean;
}

export class ServiceAccountPage extends PureComponent<Props> {
  async componentDidMount() {
    const { match } = this.props;
    this.props.loadServiceAccount(parseInt(match.params.id, 10));
  }

  render() {
    const { navModel, serviceAccount, isLoading } = this.props;

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
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'serviceaccounts'),
    serviceAccount: state.serviceAccountProfile.serviceAccount,
    isLoading: state.serviceAccountProfile.isLoading,
  };
}
const mapDispatchToProps = {
  loadServiceAccount,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = OwnProps & ConnectedProps<typeof connector>;
export default connector(ServiceAccountPage);
