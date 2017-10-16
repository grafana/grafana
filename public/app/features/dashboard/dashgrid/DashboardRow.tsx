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
      <div className="dashboard-row">
        <a className="dashboard-row__title pointer" onClick={this.toggle}>
          <i className="fa fa-chevron-down" />
          {this.props.panel.title}
        </a>
        <div className="dashboard-row__actions">
          <a className="pointer" onClick={this.openSettings}>
            <i className="fa fa-cog" />
          </a>
        </div>
        <div className="dashboard-row__panel_count">(0 hidden panels)</div>
        <div className="dashboard-row__drag grid-drag-handle" />
      </div>
    );
  }
}
