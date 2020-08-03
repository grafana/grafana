import React from 'react';
import { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import { loadAlertRule } from './state/actions';
import { AlertRule } from 'app/types';
import { getRouteParamsId } from '../../core/selectors/location';
import { getAlert } from './state/selectors';
import { contextSrv, User } from 'app/core/services/context_srv';
import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { OrgRole } from 'app/types/';
import AlertRuleSettings from './AlertRuleSettings';

export interface Props {
  navModel: NavModel;
  alert: AlertRule;
  loadAlertRule: typeof loadAlertRule;
  alertId: number;
  editorsCanAdmin: boolean;
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
    await this.fetchAlert();
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

  async fetchAlert() {
    const { loadAlertRule, alertId } = this.props;
    this.setState({ isLoading: true });
    const alert = await loadAlertRule(alertId);
    this.setState({ isLoading: false });
    return alert;
  }

  renderSettings(): React.ReactNode {
    return <AlertRuleSettings alertName={alert.name} />;
  }

  render() {
    const { navModel, alert, editorsCanAdmin, signedInUser } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={this.state.isLoading}>
          {alert && editorsCanAdmin && signedInUser.orgRole === OrgRole.Viewer && this.renderSettings()}
        </Page.Contents>
      </Page>
    );
  }
}
function mapStateToProps(state: any) {
  const alertId = getRouteParamsId(state.location);
  const alert = getAlert(state.alertRule, alertId);

  return {
    navModel: getNavModel(state.navIndex, 'alert-edit'),
    alertId: alertId,
    alert,
    editorsCanAdmin: config.editorsCanAdmin, // this makes the feature toggle mockable/controllable from tests,
    signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
  };
}

const mapDispatchToProps = {
  loadAlertRule,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(EditAlertPage));
