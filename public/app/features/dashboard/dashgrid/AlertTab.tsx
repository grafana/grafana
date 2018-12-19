import React, { PureComponent } from 'react';

import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { EditorTabBody } from './EditorTabBody';
import 'app/features/alerting/AlertTabCtrl';
import { PanelModel } from '../panel_model';

interface Props {
  angularPanel?: AngularComponent;
  panel: PanelModel;
}

export class AlertTab extends PureComponent<Props> {
  element: any;
  component: AngularComponent;

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
    return this.props.angularPanel && this.element;
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

    const panelCtrl = scope.$$childHead.ctrl;
    const loader = getAngularLoader();
    const template = '<alert-tab />';

    const scopeProps = {
      ctrl: panelCtrl,
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  render() {
    const { alert } = this.props.panel;

    const stateHistory = {
      title: 'State history',
      render: () => {
        return <div>State history</div>;
      },
    };

    const deleteAlert = {
      title: 'Delete button',
      render: () => {
        return <div>Hello</div>;
      },
    };

    const toolbarItems = alert ? [deleteAlert, stateHistory] : [];

    return (
      <EditorTabBody heading="Alert" toolbarItems={toolbarItems}>
        <div ref={element => (this.element = element)} />
      </EditorTabBody>
    );
  }
}
