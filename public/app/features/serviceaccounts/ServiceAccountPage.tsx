import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { getTimeZone, NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { ServiceAccountProfile } from './ServiceAccountProfile';
import { StoreState, ServiceAccountDTO, ApiKey } from 'app/types';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { loadServiceAccount, loadServiceAccountTokens, deleteServiceAccountToken } from './state/actions';
import { ServiceAccountTokensTable } from './ServiceAccountTokensTable';

interface OwnProps extends GrafanaRouteComponentProps<{ id: string }> {
  navModel: NavModel;
  serviceAccount?: ServiceAccountDTO;
  tokens: ApiKey[];
}

interface State {
  isLoading: boolean;
}

export class ServiceAccountPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isLoading: false,
    };
  }

  async componentDidMount() {
    await this.fetchServiceAccount();
  }

  async fetchServiceAccount() {
    const { match } = this.props;
    this.setState({ isLoading: true });
    await this.props.loadServiceAccount(parseInt(match.params.id, 10));
    await this.props.loadServiceAccountTokens();

    this.setState({ isLoading: false });
  }

  onDeleteServiceAccountToken = (key: ApiKey) => {
    this.props.deleteServiceAccountToken(key.id!);
  };

  render() {
    const { navModel, serviceAccount, timeZone, tokens } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={this.state.isLoading}>
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
              <ServiceAccountTokensTable
                apiKeys={tokens}
                timeZone={timeZone}
                onDelete={this.onDeleteServiceAccountToken}
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
    timeZone: getTimeZone(state.user),
    tokens: state.serviceAccountProfile.tokens,
  };
}
const mapDispatchToProps = {
  loadServiceAccount,
  loadServiceAccountTokens,
  deleteServiceAccountToken,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = OwnProps & ConnectedProps<typeof connector>;
export default connector(ServiceAccountPage);
