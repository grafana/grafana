import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { Alert, Button, IconName } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { AngularComponent, getAngularLoader, getDataSourceSrv } from '@grafana/runtime';

import appEvents from 'app/core/app_events';
import { getAlertingValidationMessage } from './getAlertingValidationMessage';

import { EditorTabBody, EditorToolbarView } from '../dashboard/panel_editor/EditorTabBody';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import StateHistory from './StateHistory';
import 'app/features/alerting/AlertTabCtrl';

import { DashboardModel } from '../dashboard/state/DashboardModel';
import { PanelModel } from '../dashboard/state/PanelModel';
import { TestRuleResult } from './TestRuleResult';
import { AppNotificationSeverity, CoreEvents, StoreState } from 'app/types';
import { updateLocation } from 'app/core/actions';
import { PanelEditorTabId } from '../dashboard/components/PanelEditor/types';

interface OwnProps {
  dashboard: DashboardModel;
  panel: PanelModel;
}

interface ConnectedProps {
  angularPanelComponent: AngularComponent;
}

interface DispatchProps {
  updateLocation: typeof updateLocation;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

interface State {
  validatonMessage: string;
}

class UnConnectedAlertTab extends PureComponent<Props, State> {
  element: any;
  component: AngularComponent;
  panelCtrl: any;

  state: State = {
    validatonMessage: '',
  };

  componentDidMount() {
    this.loadAlertTab();
  }

  onAngularPanelUpdated = () => {
    this.forceUpdate();
  };

  componentDidUpdate(prevProps: Props) {
    this.loadAlertTab();
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  async loadAlertTab() {
    const { panel, angularPanelComponent } = this.props;

    if (!this.element || !angularPanelComponent || this.component) {
      return;
    }

    const scope = angularPanelComponent.getScope();

    // When full page reloading in edit mode the angular panel has on fully compiled & instantiated yet
    if (!scope.$$childHead) {
      setTimeout(() => {
        this.forceUpdate();
      });
      return;
    }

    this.panelCtrl = scope.$$childHead.ctrl;
    const loader = getAngularLoader();
    const template = '<alert-tab />';

    const scopeProps = { ctrl: this.panelCtrl };

    this.component = loader.load(this.element, scopeProps, template);

    const validatonMessage = await getAlertingValidationMessage(
      panel.transformations,
      panel.targets,
      getDataSourceSrv(),
      panel.datasource
    );

    if (validatonMessage) {
      this.setState({ validatonMessage });
    }
  }

  stateHistory = (): EditorToolbarView => {
    const { panel, dashboard } = this.props;

    return {
      title: 'State history',
      render: () => {
        return (
          <StateHistory
            dashboard={dashboard}
            panelId={panel.editSourceId ?? panel.id}
            onRefresh={this.panelCtrl.refresh}
          />
        );
      },
    };
  };

  deleteAlert = (): EditorToolbarView => {
    const { panel } = this.props;
    return {
      title: 'Delete',
      btnType: 'danger',
      onClick: () => {
        appEvents.emit(CoreEvents.showConfirmModal, {
          title: 'Delete Alert',
          text: 'Are you sure you want to delete this alert rule?',
          text2: 'You need to save dashboard for the delete to take effect',
          icon: 'trash-alt',
          yesText: 'Delete',
          onConfirm: () => {
            delete panel.alert;
            panel.thresholds = [];
            this.panelCtrl.alertState = null;
            this.panelCtrl.render();
            this.forceUpdate();
          },
        });
      },
    };
  };

  renderTestRuleResult = () => {
    const { dashboard, panel } = this.props;
    return <TestRuleResult panel={panel} dashboard={dashboard} />;
  };

  testRule = (): EditorToolbarView => ({
    title: 'Test Rule',
    render: () => this.renderTestRuleResult(),
  });

  onAddAlert = () => {
    this.panelCtrl._enableAlert();
    this.component.digest();
    this.forceUpdate();
  };

  switchToQueryTab = () => {
    const { updateLocation } = this.props;
    updateLocation({ query: { tab: PanelEditorTabId.Query }, partial: true });
  };

  renderValidationMessage = () => {
    const { validatonMessage } = this.state;

    return (
      <div
        className={css`
          width: 508px;
          margin: 128px auto;
        `}
      >
        <h2>{validatonMessage}</h2>
        <br />
        <div className="gf-form-group">
          <Button size={'md'} variant={'secondary'} icon="arrow-left" onClick={this.switchToQueryTab}>
            Go back to Queries
          </Button>
        </div>
      </div>
    );
  };

  render() {
    const { alert, transformations } = this.props.panel;
    const { validatonMessage } = this.state;
    const hasTransformations = transformations && transformations.length > 0;

    if (!alert && validatonMessage) {
      return this.renderValidationMessage();
    }

    const toolbarItems = alert ? [this.stateHistory(), this.testRule(), this.deleteAlert()] : [];

    const model = {
      title: 'Panel has no alert rule defined',
      buttonIcon: 'bell' as IconName,
      onClick: this.onAddAlert,
      buttonTitle: 'Create Alert',
    };

    return (
      <EditorTabBody heading="Alert" toolbarItems={toolbarItems}>
        <div aria-label={selectors.components.AlertTab.content}>
          {alert && hasTransformations && (
            <Alert
              severity={AppNotificationSeverity.Error}
              title="Transformations are not supported in alert queries"
            />
          )}

          <div ref={element => (this.element = element)} />
          {!alert && !validatonMessage && <EmptyListCTA {...model} />}
        </div>
      </EditorTabBody>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  return {
    angularPanelComponent: state.dashboard.panels[props.panel.id].angularComponent,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { updateLocation };

export const AlertTab = connect(mapStateToProps, mapDispatchToProps)(UnConnectedAlertTab);
