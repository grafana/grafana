import React from 'react';
import classNames from 'classnames';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { store } from 'app/stores/store';

interface PanelHeaderProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelHeader extends React.Component<PanelHeaderProps, any> {
  onEditPanel = () => {
    store.view.updateQuery(
      {
        panelId: this.props.panel.id,
        edit: true,
        fullscreen: true,
      },
      false
    );
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
