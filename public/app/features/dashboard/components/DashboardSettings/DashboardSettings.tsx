// Libaries
import React, { PureComponent } from 'react';

// Utils & Services
import { AngularComponent, getAngularLoader } from 'app/core/services/AngularLoader';

// Types
import { DashboardModel } from '../../state/DashboardModel';

export interface Props {
  dashboard: DashboardModel | null;
}

export class DashboardSettings extends PureComponent<Props> {
  element: HTMLElement;
  angularCmp: AngularComponent;

  componentDidMount() {
    const loader = getAngularLoader();

    const template = '<dashboard-settings dashboard="dashboard" class="dashboard-settings" />';
    const scopeProps = { dashboard: this.props.dashboard };

    this.angularCmp = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.angularCmp) {
      this.angularCmp.destroy();
    }
  }

  render() {
    return <div className="panel-height-helper" ref={element => (this.element = element)} />;
  }
}
