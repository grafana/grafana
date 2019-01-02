import React, { PureComponent } from 'react';
import { AngularComponent, getAngularLoader } from 'app/core/services/AngularLoader';
import { EditorTabBody, EditorToolbarView, ToolbarButtonType } from './EditorTabBody';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import appEvents from 'app/core/app_events';
import { PanelModel } from '../panel_model';
import 'app/features/alerting/AlertTabCtrl';

interface Props {
  angularPanel?: AngularComponent;
  panel: PanelModel;
}

export class AlertTab extends PureComponent<Props> {
  element: any;
  component: AngularComponent;
  panelCtrl: any;

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    if (this.shouldLoadAlertTab()) {
      this.loadAlertTab();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.shouldLoadAlertTab()) {
      this.loadAlertTab();
    }
  }

  shouldLoadAlertTab() {
    return this.props.angularPanel && this.element && !this.component;
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  loadAlertTab() {
    const { angularPanel } = this.props;

    const scope = angularPanel.getScope();

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

    const scopeProps = {
      ctrl: this.panelCtrl,
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  stateHistory = (): EditorToolbarView => {
    return {
      title: 'State history',
      render: () => {
        return <div>State history</div>;
      },
      buttonType: ToolbarButtonType.View,
    };
  };

  deleteAlert = (): EditorToolbarView => {
    const { panel } = this.props;
    return {
      title: 'Delete',
      icon: 'fa fa-trash',
      onClick: () => {
        appEvents.emit('confirm-modal', {
          title: 'Delete Alert',
          text: 'Are you sure you want to delete this alert rule?',
          text2: 'You need to save dashboard for the delete to take effect',
          icon: 'fa-trash',
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
      buttonType: ToolbarButtonType.Action,
    };
  };

  onAddAlert = () => {
    this.panelCtrl._enableAlert();
    this.component.digest();
    this.forceUpdate();
  };

  render() {
    const { alert } = this.props.panel;

    const toolbarItems = alert ? [this.stateHistory(), this.deleteAlert()] : [];

    const model = {
      title: 'Panel has no alert rule defined',
      icon: 'icon-gf icon-gf-alert',
      onClick: this.onAddAlert,
      buttonTitle: 'Create Alert',
    };

    //TODO move add button react from angular and add condition to render angular view
    return (
      <EditorTabBody heading="Alert" toolbarItems={toolbarItems}>
        <>
          <div ref={element => (this.element = element)} />
          {!alert && <EmptyListCTA model={model} />}
        </>
      </EditorTabBody>
    );
  }
}
