import React from 'react';
import config from 'app/core/config';
import classNames from 'classnames';
import appEvents from 'app/core/app_events';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { AttachedPanel } from './PanelLoader';
import { DashboardRow } from './DashboardRow';
import { AddPanelPanel } from './AddPanelPanel';
import { importPluginModule } from 'app/features/plugins/plugin_loader';

export interface DashboardPanelProps {
  panel: PanelModel;
  dashboard: DashboardModel;
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

  render() {
    if (this.isSpecial()) {
      return this.specialPanels[this.props.panel.type]();
    }

    let PanelComponent = null;

    if (this.pluginExports && this.pluginExports.PanelComponent) {
      PanelComponent = this.pluginExports.PanelComponent;
    }

    return (
      <div className="panel-container">
        <PanelHeader panel={this.props.panel} dashboard={this.props.dashboard} />
        <div className="panel-content">{PanelComponent && <PanelComponent />}</div>
      </div>
    );

    // return (
    //   <div ref={element => this.element = element} className="panel-height-helper" />
    // );
  }
}

interface PanelHeaderProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelHeader extends React.Component<PanelHeaderProps, any> {
  onEditPanel = () => {
    this.props.dashboard.setViewMode(this.props.panel, true, true);
  };

  render() {
    let isFullscreen = false;
    let isLoading = false;
    let panelHeaderClass = classNames({ 'panel-header': true, 'grid-drag-handle': !isFullscreen });

    return (
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

        <div className="panel-title-container">
          <span className="panel-title">
            <span className="icon-gf panel-alert-icon" />
            <span className="panel-title-text">{this.props.panel.title}</span>
            <span className="panel-menu-container dropdown">
              <span className="fa fa-caret-down panel-menu-toggle" data-toggle="dropdown" />
              <ul className="dropdown-menu dropdown-menu--menu panel-menu" role="menu">
                <li>
                  <a onClick={this.onEditPanel}>
                    <i className="fa fa-fw fa-edit" /> Edit
                  </a>
                </li>
                <li>
                  <a href="asd">asd</a>
                </li>
              </ul>
            </span>
            <span className="panel-time-info">
              <i className="fa fa-clock-o" /> 4m
            </span>
          </span>
        </div>
      </div>
    );
  }
}
