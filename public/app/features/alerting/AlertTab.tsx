import _ from 'lodash';
import React, { Component, useEffect } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { Alert, Button } from '@grafana/ui';

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
import { AppNotificationSeverity, StoreState } from 'app/types';
import { PanelEditorTabIds, getPanelEditorTab } from '../dashboard/panel_editor/state/reducers';
import { changePanelEditorTab } from '../dashboard/panel_editor/state/actions';
import { CoreEvents } from 'app/types';
import { PanelCtrl } from '../panel/panel_ctrl';

interface Props {
  angularPanel?: AngularComponent;
  dashboard: DashboardModel;
  panel: PanelModel;
  changePanelEditorTab: typeof changePanelEditorTab;
}

interface State {
  validationMessage: string;
  alerts: any[];
}

class UnConnectedAlertTab extends Component<Props, State> {
  panelCtrl: any;

  state: State = {
    validationMessage: '',
    alerts: [],
  };

  componentDidMount() {
    this.migrateAlert();
    if (this.shouldLoadAlertTab()) {
      this.loadAlertTab();
    }
  }

  componentDidUpdate(prevProps: Props) {
    this.migrateAlert();
    if (this.shouldLoadAlertTab()) {
      this.loadAlertTab();
    }
  }

  migrateAlert() {
    if (_.isArray(this.props.panel.alert)) {
      if (this.props.panel.alert !== this.state.alerts) {
        this.setState({ ...this.state, alerts: this.props.panel.alert });
      }
    } else if (_.isObject(this.props.panel.alert)) {
      this.props.panel.alert = [this.props.panel.alert];
      this.setState({ ...this.state, alerts: this.props.panel.alert });
    } else {
      this.props.panel.alert = [];
      this.setState({ ...this.state, alerts: this.props.panel.alert });
    }
  }

  shouldLoadAlertTab() {
    return this.props.angularPanel;
  }

  async loadAlertTab() {
    const { angularPanel, panel } = this.props;

    const scope = angularPanel.getScope();

    // When full page reloading in edit mode the angular panel has on fully compiled & instantiated yet
    if (!scope.$$childHead) {
      setTimeout(() => {
        this.forceUpdate();
      });
      return;
    }

    this.panelCtrl = scope.$$childHead.ctrl;

    const validationMessage = await getAlertingValidationMessage(
      panel.transformations,
      panel.targets,
      getDataSourceSrv(),
      panel.datasource
    );

    if (validationMessage) {
      this.setState({ ...this.state, validationMessage });
    }
  }

  onAddAlert = () => {
    this.state.alerts.push({});
    this.setState(this.state);
  };

  onDeleteAlert = (key: number) => () => {
    // this.state.alerts.splice(key, 1);
    delete this.state.alerts[key];
    this.setState(this.state);
  };

  switchToQueryTab = () => {
    const { changePanelEditorTab } = this.props;
    changePanelEditorTab(getPanelEditorTab(PanelEditorTabIds.Queries));
  };

  renderValidationMessage = () => {
    const { validationMessage } = this.state;

    return (
      <div
        className={css`
          width: 508px;
          margin: 128px auto;
        `}
      >
        <h2>{validationMessage}</h2>
        <br />
        <div className="gf-form-group">
          <Button size={'md'} variant={'secondary'} icon="fa fa-arrow-left" onClick={this.switchToQueryTab}>
            Go back to Queries
          </Button>
        </div>
      </div>
    );
  };

  render() {
    const { alert, transformations } = this.props.panel;
    const { validationMessage } = this.state;
    const hasTransformations = transformations && transformations.length > 0;

    if (!alert && validationMessage) {
      return this.renderValidationMessage();
    }

    const model = {
      title: 'Add an alert rule',
      buttonIcon: 'gicon gicon-alert',
      onClick: this.onAddAlert,
      buttonTitle: 'Create Alert',
    };

    if (!this.panelCtrl) {
      setTimeout(() => this.forceUpdate(), 0);
      return null;
    }
    return (
      <EditorTabBody heading="Alert">
        <>
          {alert && hasTransformations && (
            <Alert
              severity={AppNotificationSeverity.Error}
              title="Transformations are not supported in alert queries"
            />
          )}
          {this.state.alerts.map((alert, index) => (
            <SingleAlertTab
              onDelete={this.onDeleteAlert(index)}
              panelCtrl={this.panelCtrl}
              alert={alert}
              key={index}
              index={index}
            />
          ))}
          {!validationMessage && <EmptyListCTA {...model} />}
        </>
      </EditorTabBody>
    );
  }
}

export const mapStateToProps = (state: StoreState) => ({});

const mapDispatchToProps = { changePanelEditorTab };

export const AlertTab = hot(module)(connect(mapStateToProps, mapDispatchToProps)(UnConnectedAlertTab));

interface SingleAlertTabProps {
  panelCtrl: PanelCtrl;
  alert: any;
  onDelete: () => void;
  index: number;
}

const SingleAlertTab = ({ index, panelCtrl, alert, onDelete }: SingleAlertTabProps) => {
  let element: any;
  useEffect(() => {
    const component = getAngularLoader().load(element, { ctrl: panelCtrl, alert: alert }, `<alert-tab />`);
    return () => component.destroy();
  }, [panelCtrl]);
  const stateHistory = (): EditorToolbarView => {
    return {
      title: 'State history',
      render: () => {
        return (
          <StateHistory dashboard={panelCtrl.dashboard} panelId={panelCtrl.panel.id} onRefresh={panelCtrl.refresh} />
        );
      },
    };
  };
  const testRule = (): EditorToolbarView => ({
    title: 'Test Rule',
    render: () => {
      const { panel, dashboard } = panelCtrl;
      return <TestRuleResult panelId={panel.id} dashboard={dashboard} />;
    },
  });
  const deleteAlert = (): EditorToolbarView => {
    return {
      title: 'Delete',
      btnType: 'danger',
      onClick: () => {
        appEvents.emit(CoreEvents.showConfirmModal, {
          title: 'Delete Alert',
          text: 'Are you sure you want to delete this alert rule?',
          text2: 'You need to save dashboard for the delete to take effect',
          icon: 'fa-trash',
          yesText: 'Delete',
          onConfirm: () => {
            onDelete();
          },
        });
      },
    };
  };

  const { transformations } = panelCtrl.panel;
  const hasTransformations = transformations && transformations.length > 0;
  const toolbarItems = [stateHistory(), testRule(), deleteAlert()];
  return (
    <EditorTabBody heading={`Alert ${index}`} toolbarItems={toolbarItems}>
      {hasTransformations ? (
        <Alert severity={AppNotificationSeverity.Error} title="Transformations are not supported in alert queries" />
      ) : (
        <div
          ref={e => {
            element = e;
          }}
        />
      )}
    </EditorTabBody>
  );
};
