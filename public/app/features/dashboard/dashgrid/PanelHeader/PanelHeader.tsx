import React, { PureComponent } from 'react';
import classNames from 'classnames';

import { PanelHeaderMenu } from './PanelHeaderMenu';
import Tooltip from 'app/core/components/Tooltip/Tooltip';

import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { ClickOutsideWrapper } from 'app/core/components/ClickOutsideWrapper/ClickOutsideWrapper';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  timeInfo: string;
}

interface State {
  panelMenuOpen: boolean;
}

export class PanelHeader extends PureComponent<Props, State> {
  state = {
    panelMenuOpen: false,
  };

  onMenuToggle = event => {
    event.stopPropagation();

    this.setState(prevState => ({
      panelMenuOpen: !prevState.panelMenuOpen,
    }));
  };

  closeMenu = () => {
    this.setState({
      panelMenuOpen: false,
    });
  };

  render() {
    const isFullscreen = false;
    const isLoading = false;
    const panelHeaderClass = classNames({ 'panel-header': true, 'grid-drag-handle': !isFullscreen });
    const { panel, dashboard, timeInfo } = this.props;
    return (
      <div className={panelHeaderClass}>
        {panel.description && (
          <Tooltip content={panel.description}>
            <span className="panel-info-corner panel-info-corner--info">
              <i className="fa" />
              <span className="panel-info-corner-inner" />
            </span>
          </Tooltip>
        )}
        {isLoading && (
          <span className="panel-loading">
            <i className="fa fa-spinner fa-spin" />
          </span>
        )}

        <div className="panel-title-container" onClick={this.onMenuToggle}>
          <div className="panel-title">
            <span className="icon-gf panel-alert-icon" />
            <span className="panel-title-text">
              {panel.title} <span className="fa fa-caret-down panel-menu-toggle" />
            </span>

            {this.state.panelMenuOpen && (
              <ClickOutsideWrapper onClick={this.closeMenu}>
                <PanelHeaderMenu panel={panel} dashboard={dashboard} />
              </ClickOutsideWrapper>
            )}

            {timeInfo && (
              <span className="panel-time-info">
                <i className="fa fa-clock-o" /> {timeInfo}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
}
