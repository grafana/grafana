import React from 'react';
import $ from 'jquery';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';
import { PanelHeader } from './PanelHeader';
import { PanelEditor } from './PanelEditor';

const TITLE_HEIGHT = 27;
const PANEL_BORDER = 2;

export interface PanelChromeProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  component: any;
}

export class PanelChrome extends React.Component<PanelChromeProps, any> {
  constructor(props) {
    super(props);

    this.props.panel.events.on('panel-size-changed', this.triggerForceUpdate.bind(this));
  }

  triggerForceUpdate() {
    this.forceUpdate();
  }

  render() {
    let panelContentStyle = {
      height: this.getPanelHeight(),
    };

    let PanelComponent = this.props.component;
    console.log('PanelChrome render');

    return (
      <div className="panel-height-helper">
        <div className="panel-container">
          <PanelHeader panel={this.props.panel} dashboard={this.props.dashboard} />
          <div className="panel-content" style={panelContentStyle}>
            {<PanelComponent />}
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
