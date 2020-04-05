import React, { Component } from 'react';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import { DataLink, ScopedVars, PanelMenuItem, PanelData, LoadingState, QueryResultMetaNotice } from '@grafana/data';
import { AngularComponent } from '@grafana/runtime';
import { ClickOutsideWrapper, Tooltip } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import PanelHeaderCorner from './PanelHeaderCorner';
import { PanelHeaderMenu } from './PanelHeaderMenu';
import templateSrv from 'app/features/templating/template_srv';

import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { getPanelMenu } from 'app/features/dashboard/utils/getPanelMenu';
import { updateLocation } from 'app/core/actions';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  title?: string;
  description?: string;
  scopedVars?: ScopedVars;
  angularComponent?: AngularComponent | null;
  links?: DataLink[];
  error?: string;
  isFullscreen: boolean;
  data: PanelData;
  updateLocation: typeof updateLocation;
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

  openInspect = (e: React.SyntheticEvent, tab: string) => {
    const { updateLocation, panel } = this.props;

    e.stopPropagation();

    updateLocation({
      query: { inspect: panel.id, tab },
      partial: true,
    });
  };

  renderNotice = (notice: QueryResultMetaNotice) => {
    return (
      <Tooltip content={notice.text} key={notice.severity}>
        {notice.inspect ? (
          <div className="panel-info-notice" onClick={e => this.openInspect(e, notice.inspect!)}>
            <span className="fa fa-info-circle" style={{ marginRight: '8px', cursor: 'pointer' }} />
          </div>
        ) : (
          <a className="panel-info-notice" href={notice.url} target="_blank">
            <span className="fa fa-info-circle" style={{ marginRight: '8px', cursor: 'pointer' }} />
          </a>
        )}
      </Tooltip>
    );
  };

  render() {
    const { panel, scopedVars, error, isFullscreen, data } = this.props;
    const { menuItems } = this.state;
    const title = templateSrv.replaceWithText(panel.title, scopedVars);

    const panelHeaderClass = classNames({
      'panel-header': true,
      'grid-drag-handle': !isFullscreen,
    });

    // dedupe on severity
    const notices: Record<string, QueryResultMetaNotice> = {};

    for (const series of data.series) {
      if (series.meta && series.meta.notices) {
        for (const notice of series.meta.notices) {
          notices[notice.severity] = notice;
        }
      }
    }

    return (
      <>
        {data.state === LoadingState.Loading && this.renderLoadingState()}
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
              {Object.values(notices).map(this.renderNotice)}
              <span className="icon-gf panel-alert-icon" />
              <span className="panel-title-text">
                {title} <span className="fa fa-caret-down panel-menu-toggle" />
              </span>
              {this.state.panelMenuOpen && (
                <ClickOutsideWrapper onClick={this.closeMenu}>
                  <PanelHeaderMenu items={menuItems} />
                </ClickOutsideWrapper>
              )}
              {data.request && data.request.timeInfo && (
                <span className="panel-time-info">
                  <i className="fa fa-clock-o" /> {data.request.timeInfo}
                </span>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
}
