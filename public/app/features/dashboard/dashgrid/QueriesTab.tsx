import React from 'react';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { getAngularLoader, AngularComponent } from 'app/core/services/angular_loader';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class QueriesTab extends React.Component<Props, any> {
  element: any;
  component: AngularComponent;

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }

    let loader = getAngularLoader();
    var template = '<metrics-tab />';
    let scopeProps = {
      ctrl: {
        panel: this.props.panel,
        dashboard: this.props.dashboard,
        panelCtrl: {
          panel: this.props.panel,
          dashboard: this.props.dashboard,
        },
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  render() {
    return <div ref={element => (this.element = element)} className="panel-height-helper" />;
  }
}
