import React, { PureComponent } from 'react';
import classNames from 'classnames';

import { PanelHeaderMenu } from './PanelHeaderMenu';

import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { ClickOutsideWrapper } from '../../../../core/components/ClickOutsideWrapper/ClickOutsideWrapper';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
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

    console.log('toggle menu');
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

            <span className="panel-time-info">
              <i className="fa fa-clock-o" /> 4m
            </span>
          </div>
        </div>
      </div>
    );
  }
}
