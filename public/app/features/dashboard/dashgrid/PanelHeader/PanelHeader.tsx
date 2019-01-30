import React, { Component } from 'react';
import classNames from 'classnames';
import { isEqual } from 'lodash';

import PanelHeaderCorner from './PanelHeaderCorner';
import { PanelHeaderMenu } from './PanelHeaderMenu';
import templateSrv from 'app/features/templating/template_srv';

import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { ClickOutsideWrapper } from 'app/core/components/ClickOutsideWrapper/ClickOutsideWrapper';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  timeInfo: string;
  title?: string;
  description?: string;
  scopedVars?: string;
  links?: [];
}

interface ClickCoordinates {
  x: number;
  y: number;
}

interface State {
  panelMenuOpen: boolean;
}

export class PanelHeader extends Component<Props, State> {
  clickCoordinates: ClickCoordinates = {x: 0, y: 0};
  state = {
    panelMenuOpen: false,
    clickCoordinates: {x: 0, y: 0}
  };

  eventToClickCoordinates = (event: React.MouseEvent<HTMLDivElement>) => {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }

  onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    this.clickCoordinates = this.eventToClickCoordinates(event);
  };

  isClick = (clickCoordinates: ClickCoordinates) => {
    return isEqual(clickCoordinates, this.clickCoordinates);
  }

  onMenuToggle = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.isClick(this.eventToClickCoordinates(event))) {
      event.stopPropagation();

      this.setState(prevState => ({
        panelMenuOpen: !prevState.panelMenuOpen,
      }));
    }
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
    const { panel, dashboard, timeInfo, scopedVars } = this.props;
    const title = templateSrv.replaceWithText(panel.title, scopedVars);

    return (
      <>
        <PanelHeaderCorner
          panel={panel}
          title={panel.title}
          description={panel.description}
          scopedVars={panel.scopedVars}
          links={panel.links}
        />
        <div className={panelHeaderClass}>
          {isLoading && (
            <span className="panel-loading">
              <i className="fa fa-spinner fa-spin" />
            </span>
          )}
          <div className="panel-title-container" onClick={this.onMenuToggle} onMouseDown={this.onMouseDown}>
            <div className="panel-title">
              <span className="icon-gf panel-alert-icon" />
              <span className="panel-title-text">
                {title} <span className="fa fa-caret-down panel-menu-toggle" />
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
      </>
    );
  }
}
