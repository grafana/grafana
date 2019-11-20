import React, { Component } from 'react';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import { ScopedVars } from '@grafana/data';

import PanelHeaderCorner from './PanelHeaderCorner';
import { PanelHeaderMenu } from './PanelHeaderMenu';
import templateSrv from 'app/features/templating/template_srv';

import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { ClickOutsideWrapper } from '@grafana/ui';
import { DataLink } from '@grafana/data';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  timeInfo: string;
  title?: string;
  description?: string;
  scopedVars?: ScopedVars;
  links?: DataLink[];
  error?: string;
  isFullscreen: boolean;
}

interface ClickCoordinates {
  x: number;
  y: number;
}

interface State {
  panelMenuOpen: boolean;
}

export class PanelHeader extends Component<Props, State> {
  clickCoordinates: ClickCoordinates = { x: 0, y: 0 };
  state = {
    panelMenuOpen: false,
    clickCoordinates: { x: 0, y: 0 },
  };

  eventToClickCoordinates = (event: React.MouseEvent<HTMLDivElement>) => {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  };

  onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    this.clickCoordinates = this.eventToClickCoordinates(event);
  };

  isClick = (clickCoordinates: ClickCoordinates) => {
    return isEqual(clickCoordinates, this.clickCoordinates);
  };

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
    const { panel, dashboard, timeInfo, scopedVars, error, isFullscreen } = this.props;
    const title = templateSrv.replaceWithText(panel.title, scopedVars);

    const panelHeaderClass = classNames({
      'panel-header': true,
      'grid-drag-handle': !isFullscreen,
    });

    return (
      <>
        <div className={panelHeaderClass}>
          <PanelHeaderCorner
            panel={panel}
            title={panel.title}
            description={panel.description}
            scopedVars={panel.scopedVars}
            links={getPanelLinksSupplier(panel)}
            error={error}
          />
          <div
            className="panel-title-container"
            onClick={this.onMenuToggle}
            onMouseDown={this.onMouseDown}
            aria-label="Panel Title"
          >
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
