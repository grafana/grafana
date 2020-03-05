import React, { Component } from 'react';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import { DataLink, ScopedVars, PanelMenuItem } from '@grafana/data';
import { AngularComponent } from '@grafana/runtime';
import { ClickOutsideWrapper } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import PanelHeaderCorner from './PanelHeaderCorner';
import { PanelHeaderMenu } from './PanelHeaderMenu';
import templateSrv from 'app/features/templating/template_srv';

import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { getPanelMenu } from 'app/features/dashboard/utils/getPanelMenu';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  timeInfo?: string;
  title?: string;
  description?: string;
  scopedVars?: ScopedVars;
  angularComponent?: AngularComponent;
  links?: DataLink[];
  error?: string;
  isFullscreen: boolean;
  isLoading: boolean;
}

interface ClickCoordinates {
  x: number;
  y: number;
}

interface State {
  panelMenuOpen: boolean;
  menuItems: PanelMenuItem[];
}

export class PanelHeader extends Component<Props, State> {
  clickCoordinates: ClickCoordinates = { x: 0, y: 0 };

  state: State = {
    panelMenuOpen: false,
    menuItems: [],
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
    if (!this.isClick(this.eventToClickCoordinates(event))) {
      return;
    }

    event.stopPropagation();

    const { dashboard, panel, angularComponent } = this.props;
    const menuItems = getPanelMenu(dashboard, panel, angularComponent);

    this.setState({
      panelMenuOpen: !this.state.panelMenuOpen,
      menuItems,
    });
  };

  closeMenu = () => {
    this.setState({
      panelMenuOpen: false,
    });
  };

  private renderLoadingState(): JSX.Element {
    return (
      <div className="panel-loading">
        <i className="fa fa-spinner fa-spin" />
      </div>
    );
  }

  render() {
    const { panel, timeInfo, scopedVars, error, isFullscreen, isLoading } = this.props;
    const { menuItems } = this.state;
    const title = templateSrv.replaceWithText(panel.title, scopedVars);

    const panelHeaderClass = classNames({
      'panel-header': true,
      'grid-drag-handle': !isFullscreen,
    });

    return (
      <>
        {isLoading && this.renderLoadingState()}
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
            aria-label={e2e.pages.Dashboard.Panels.Panel.selectors.title(title)}
          >
            <div className="panel-title">
              <span className="icon-gf panel-alert-icon" />
              <span className="panel-title-text">
                {title} <span className="fa fa-caret-down panel-menu-toggle" />
              </span>
              {this.state.panelMenuOpen && (
                <ClickOutsideWrapper onClick={this.closeMenu}>
                  <PanelHeaderMenu items={menuItems} />
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
