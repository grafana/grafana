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

    const { panel, dashboard } = this.props;

    // make sure the panel has datasource & queries properties
    panel.datasource = panel.datasource || null;
    panel.targets = panel.targets || [{}];

    const loader = getAngularLoader();
    const template = '<metrics-tab />';
    const scopeProps = {
      ctrl: {
        panel: panel,
        dashboard: dashboard,
        panelCtrl: {
          panel: panel,
          dashboard: dashboard,
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
