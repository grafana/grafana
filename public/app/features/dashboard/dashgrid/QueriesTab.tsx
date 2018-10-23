// Libraries
import React, { PureComponent } from 'react';

// Services & utils
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';

// Types
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class QueriesTab extends PureComponent<Props> {
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

    const loader = getAngularLoader();
    const template = '<metrics-tab />';
    const scopeProps = {
      ctrl: {
        panel: panel,
        dashboard: dashboard,
        refresh: () => panel.refresh(),
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
