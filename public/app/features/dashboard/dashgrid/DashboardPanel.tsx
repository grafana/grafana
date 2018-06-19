import React from 'react';
import config from 'app/core/config';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { AttachedPanel } from './PanelLoader';
import { DashboardRow } from './DashboardRow';
import { PanelContainer } from './PanelContainer';
import { AddPanelPanel } from './AddPanelPanel';
import { importPluginModule } from 'app/features/plugins/plugin_loader';
import { PanelChrome } from './PanelChrome';

export interface DashboardPanelProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  panelContainer: PanelContainer;
}

export class DashboardPanel extends React.Component<DashboardPanelProps, any> {
  element: any;
  attachedPanel: AttachedPanel;
  pluginInfo: any;
  pluginExports: any;
  specialPanels = {};

  constructor(props) {
    super(props);
    this.state = {};

    this.specialPanels['row'] = this.renderRow.bind(this);
    this.specialPanels['add-panel'] = this.renderAddPanel.bind(this);

    if (!this.isSpecial()) {
      this.pluginInfo = config.panels[this.props.panel.type];

      // load panel plugin
      importPluginModule(this.pluginInfo.module).then(pluginExports => {
        this.pluginExports = pluginExports;
        this.forceUpdate();
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
    if (!this.element || this.attachedPanel) {
      return;
    }

    const loader = this.props.panelContainer.getPanelLoader();
    this.attachedPanel = loader.load(this.element, this.props.panel, this.props.dashboard);
  }

  componentWillUnmount() {
    if (this.attachedPanel) {
      this.attachedPanel.destroy();
    }
  }

  render() {
    if (this.isSpecial()) {
      return this.specialPanels[this.props.panel.type]();
    }

    if (!this.pluginExports) {
      return null;
    }

    if (this.pluginExports.PanelComponent) {
      return (
        <PanelChrome
          component={this.pluginExports.PanelComponent}
          panel={this.props.panel}
          dashboard={this.props.dashboard}
        />
      );
    }

    // legacy angular rendering
    return <div ref={element => (this.element = element)} className="panel-height-helper" />;
  }
}
