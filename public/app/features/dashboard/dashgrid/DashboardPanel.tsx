import React from 'react';
import config from 'app/core/config';
import classNames from 'classnames';
import { PanelModel } from '../panel_model';
import { PanelContainer } from './PanelContainer';
import { AttachedPanel } from './PanelLoader';
import { DashboardRow } from './DashboardRow';
import { AddPanelPanel } from './AddPanelPanel';
import { importPluginModule } from 'app/features/plugins/plugin_loader';

export interface DashboardPanelProps {
  panel: PanelModel;
  getPanelContainer: () => PanelContainer;
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

  componentDidMount() {
    if (!this.element) {
      return;
    }

    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();
    const loader = panelContainer.getPanelLoader();
    this.attachedPanel = loader.load(this.element, this.props.panel, dashboard);
  }

  componentWillUnmount() {
    if (this.attachedPanel) {
      this.attachedPanel.destroy();
    }
  }

  isSpecial() {
    return this.specialPanels[this.props.panel.type];
  }

  renderRow() {
    return <DashboardRow panel={this.props.panel} getPanelContainer={this.props.getPanelContainer} />;
  }

  renderAddPanel() {
    return <AddPanelPanel panel={this.props.panel} getPanelContainer={this.props.getPanelContainer} />;
  }

  render() {
    if (this.isSpecial()) {
      return this.specialPanels[this.props.panel.type]();
    }

    let isFullscreen = false;
    let isLoading = false;
    let panelHeaderClass = classNames({ 'panel-header': true, 'grid-drag-handle': !isFullscreen });
    let PanelComponent = null;

    if (this.pluginExports && this.pluginExports.PanelComponent) {
      PanelComponent = this.pluginExports.PanelComponent;
    }

    return (
      <div className="panel-container">
        <div className={panelHeaderClass}>
          <span className="panel-info-corner">
            <i className="fa" />
            <span className="panel-info-corner-inner" />
          </span>

          {isLoading && (
            <span className="panel-loading">
              <i className="fa fa-spinner fa-spin" />
            </span>
          )}
          <div className="panel-title-container">{this.props.panel.title}</div>
        </div>

        <div className="panel-content">{PanelComponent && <PanelComponent />}</div>
      </div>
    );

    // return (
    //   <div ref={element => this.element = element} className="panel-height-helper" />
    // );
  }
}
