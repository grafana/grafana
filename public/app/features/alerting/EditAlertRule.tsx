import React from 'react';
import { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import Page from 'app/core/components/Page/Page';
import { loadAlertRule } from './state/actions';
import { AlertRule } from 'app/types';
import { getRouteParamsId } from '../../core/selectors/location';
import { contextSrv, User } from 'app/core/services/context_srv';
import { NavModel, OrgRole } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import AlertRuleSettings from './AlertRuleSettings';
import { getAlertRuleLoadingNav } from './state/navModel';
import { getAlertRule } from './state/selectors';

export interface Props {
  navModel: NavModel;
  alertRule: AlertRule;
  loadAlertRule: typeof loadAlertRule;
  alertId: number;
  signedInUser: User;
}

interface State {
  isLoading: boolean;
}

export class EditAlertPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isLoading: false,
    };
  }

  async componentDidMount() {
    await this.fetchAlertRule();
  }

  /*
  componentDidUpdate(prevProps: Props) {
    this.fetchAlert();
  }

  onSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
  }

  onTest = async (evt: React.FormEvent<HTMLFormElement>) => {
  }

  onDelete = () => {
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Delete',
      text: 'Are you sure you want to delete this data source?',
      yesText: 'Delete',
      icon: 'trash-alt',
      onConfirm: () => {
        this.confirmDelete();
      },
    });
  };


  confirmDelete = () => {
  };
  */

  async fetchAlertRule() {
    const { loadAlertRule, alertId } = this.props;
    this.setState({ isLoading: true });
    const alertRule = await loadAlertRule(alertId);
    this.setState({ isLoading: false });
    return alertRule;
  }

  renderSettings(): React.ReactNode {
    return <AlertRuleSettings />;
  }

  render() {
    const { navModel, alertRule, signedInUser } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={this.state.isLoading}>
          {alertRule &&
            alertRule.orgId === signedInUser.orgId &&
            (signedInUser.orgRole === OrgRole.Editor || signedInUser.orgRole === OrgRole.Admin) &&
            this.renderSettings()}
        </Page.Contents>
      </Page>
    );
  }
}
function mapStateToProps(state: any) {
  const alertId = getRouteParamsId(state.location);
  const alertRule = getAlertRule(state.alertRule, alertId);

  return {
    navModel: getNavModel(state.navIndex, `alert-${alertId}`, getAlertRuleLoadingNav()),
    alertId: alertId,
    alertRule,
    signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
  };
}

const mapDispatchToProps = {
  loadAlertRule,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(EditAlertPage));
