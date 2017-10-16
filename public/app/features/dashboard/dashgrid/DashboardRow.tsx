import React from 'react';
import {PanelModel} from '../panel_model';

export interface DashboardRowProps {
  panel: PanelModel;
}

export class DashboardRow extends React.Component<DashboardRowProps, any> {
  constructor(props) {
    super(props);

    this.toggle = this.toggle.bind(this);
    this.openSettings = this.openSettings.bind(this);
  }

  toggle() {}

  openSettings() {}

  render() {
    return (
      <div>
        <div className="dashboard-row__center">
          <div className="dashboard-row__actions-left">
            <i className="fa fa-chevron-down" />
            <i className="fa fa-chevron-right" />
          </div>
          <a className="dashboard-row__title pointer" onClick={this.toggle}>
            <span className="dashboard-row__title-text">{this.props.panel.title}</span>
          </a>
          <div className="dashboard-row__actions-right">
            <a className="pointer" onClick={this.openSettings}>
              <i className="fa fa-cog" />
            </a>
          </div>
        </div>
        <div className="dashboard-row__panel_count">(0 hidden panels)</div>
        <div className="dashboard-row__drag grid-drag-handle" />
      </div>
    );
  }
}
