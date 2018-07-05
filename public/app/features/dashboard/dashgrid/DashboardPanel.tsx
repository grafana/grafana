import React from 'react';
import config from 'app/core/config';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { getAngularLoader, AngularComponent } from 'app/core/services/angular_loader';
import { DashboardRow } from './DashboardRow';
import { AddPanelPanel } from './AddPanelPanel';
import { importPluginModule, PluginExports } from 'app/features/plugins/plugin_loader';
import { PanelChrome } from './PanelChrome';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export interface State {
  pluginExports: PluginExports;
}

export class DashboardPanel extends React.Component<Props, State> {
  element: any;
  angularPanel: AngularComponent;
  pluginInfo: any;
  specialPanels = {};

  constructor(props) {
    super(props);
    this.state = { pluginExports: null };

    this.specialPanels['row'] = this.renderRow.bind(this);
    this.specialPanels['add-panel'] = this.renderAddPanel.bind(this);

    if (!this.isSpecial()) {
      this.pluginInfo = config.panels[this.props.panel.type];

      // load panel plugin
      importPluginModule(this.pluginInfo.module).then(pluginExports => {
        this.setState({ pluginExports: pluginExports });
      });
    }
  }

  isSpecial() {
    return this.specialPanels[this.props.panel.type];
  }

  renderRow() {
    return <DashboardRow panel={this.props.panel} dashboard={this.props.dashboard} />;
  }

  renderAddPanel() {
    return <AddPanelPanel panel={this.props.panel} dashboard={this.props.dashboard} />;
  }

  componentDidUpdate() {
    // skip loading angular component if we have no element
    // or we have already loaded it
    if (!this.element || this.angularPanel) {
      return;
    }

    let loader = getAngularLoader();
    var template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
    let scopeProps = { panel: this.props.panel, dashboard: this.props.dashboard };
    this.angularPanel = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.angularPanel) {
      this.angularPanel.destroy();
    }
  }

  render() {
    const { pluginExports } = this.state;

    if (this.isSpecial()) {
      return this.specialPanels[this.props.panel.type]();
    }

    if (!pluginExports) {
      return null;
    }

    if (pluginExports.PanelComponent) {
      return (
        <PanelChrome
          key="asd"
          component={pluginExports.PanelComponent}
          panel={this.props.panel}
          dashboard={this.props.dashboard}
        />
      );
    }

    // legacy angular rendering
    return <div ref={element => (this.element = element)} className="panel-height-helper" />;
  }
}
