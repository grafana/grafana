import React, { PureComponent } from 'react';
import classNames from 'classnames';

import { PanelHeaderMenu } from './PanelHeaderMenu';

import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelHeader extends PureComponent<Props> {
  render() {
    const isFullscreen = false;
    const isLoading = false;
    const panelHeaderClass = classNames({ 'panel-header': true, 'grid-drag-handle': !isFullscreen });
    const { panel, dashboard } = this.props;

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
          <div className="panel-title">
            <span className="icon-gf panel-alert-icon" />
            <span className="panel-title-text" data-toggle="dropdown">
              {panel.title} <span className="fa fa-caret-down panel-menu-toggle" />
            </span>

            <PanelHeaderMenu panel={panel} dashboard={dashboard} />

            <span className="panel-time-info">
              <i className="fa fa-clock-o" /> 4m
            </span>
          </div>
        </div>
      </div>
    );
  }
}
