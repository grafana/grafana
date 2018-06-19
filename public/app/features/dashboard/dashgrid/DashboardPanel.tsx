import React from 'react';
import $ from 'jquery';
import config from 'app/core/config';
import classNames from 'classnames';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { AttachedPanel } from './PanelLoader';
import { DashboardRow } from './DashboardRow';
import { AddPanelPanel } from './AddPanelPanel';
import { importPluginModule } from 'app/features/plugins/plugin_loader';
import { store } from 'app/stores/store';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';

const TITLE_HEIGHT = 27;
const PANEL_BORDER = 2;

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

    let panelContentStyle = {
      height: this.getPanelHeight(),
    };

    return (
      <div>
        <div className="panel-container">
          <PanelHeader panel={this.props.panel} dashboard={this.props.dashboard} />
          <div className="panel-content" style={panelContentStyle}>
            {PanelComponent && <PanelComponent />}
          </div>
        </div>
        <div>
          {this.props.panel.isEditing && <PanelEditor panel={this.props.panel} dashboard={this.props.dashboard} />}
        </div>
      </div>
    );
  }

  getPanelHeight() {
    const panel = this.props.panel;
    let height = 0;

    if (panel.fullscreen) {
      var docHeight = $(window).height();
      var editHeight = Math.floor(docHeight * 0.4);
      var fullscreenHeight = Math.floor(docHeight * 0.8);
      height = panel.isEditing ? editHeight : fullscreenHeight;
    } else {
      height = panel.gridPos.h * GRID_CELL_HEIGHT + (panel.gridPos.h - 1) * GRID_CELL_VMARGIN;
    }

    return height - PANEL_BORDER + TITLE_HEIGHT;
  }
}

interface PanelHeaderProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelHeader extends React.Component<PanelHeaderProps, any> {
  onEditPanel = () => {
    store.view.updateQuery({
      panelId: this.props.panel.id,
      edit: true,
      fullscreen: true,
    });
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

interface PanelEditorProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelEditor extends React.Component<PanelEditorProps, any> {
  render() {
    return (
      <div className="tabbed-view tabbed-view--panel-edit">
        <div className="tabbed-view-header">
          <h3 className="tabbed-view-panel-title">{this.props.panel.type}</h3>

          <ul className="gf-tabs">
            <li className="gf-tabs-item">
              <a className="gf-tabs-link active">Queries</a>
            </li>
            <li className="gf-tabs-item">
              <a className="gf-tabs-link">Visualization</a>
            </li>
          </ul>

          <button className="tabbed-view-close-btn" ng-click="ctrl.exitFullscreen();">
            <i className="fa fa-remove" />
          </button>
        </div>

        <div className="tabbed-view-body">testing</div>
      </div>
    );
  }
}
