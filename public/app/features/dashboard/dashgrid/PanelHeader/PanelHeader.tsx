import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelHeaderMenu } from './PanelHeaderMenu';

interface PanelHeaderProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  withMenuOptions: any;
}
export class PanelHeader extends PureComponent<PanelHeaderProps, any> {
  render() {
    const { dashboard, withMenuOptions, panel } = this.props;
    const isFullscreen = false;
    const isLoading = false;
    const panelHeaderClass = classNames({ 'panel-header': true, 'grid-drag-handle': !isFullscreen });
    const PanelHeaderMenuComponent = withMenuOptions ? withMenuOptions(PanelHeaderMenu, panel) : PanelHeaderMenu;

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
              {this.props.panel.title} <span className="fa fa-caret-down panel-menu-toggle" />
            </span>

            <PanelHeaderMenuComponent panelId={panel.id} dashboard={dashboard} />
            <span className="panel-time-info">
              <i className="fa fa-clock-o" /> 4m
            </span>
          </div>
        </div>
      </div>
    );
  }
}
