import React from 'react';
import classNames from 'classnames';
import {PanelModel} from '../panel_model';
import {PanelContainer} from './PanelContainer';
import appEvents from 'app/core/app_events';

export interface DashboardRowProps {
  panel: PanelModel;
  getPanelContainer: () => PanelContainer;
}

export class DashboardRow extends React.Component<DashboardRowProps, any> {
  constructor(props) {
    super(props);

    this.state = {
      collapsed: this.props.panel.collapsed,
    };

    this.toggle = this.toggle.bind(this);
    this.openSettings = this.openSettings.bind(this);
  }

  toggle() {
    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();

    dashboard.toggleRow(this.props.panel);

    this.setState(prevState => {
      return {collapsed: !prevState.collapsed};
    });
  }

  openSettings() {
    appEvents.emit('show-modal', {
      src: 'public/app/features/dashboard/partials/shareModal.html',
      scope: shareScope
    });
  }

  render() {
    const classes = classNames({'dashboard-row': true, 'dashboard-row--collapsed': this.state.collapsed});
    const chevronClass = classNames({'fa': true, 'fa-chevron-down': !this.state.collapsed, 'fa-chevron-right': this.state.collapsed});
    const hiddenPanels = this.props.panel.panels ? this.props.panel.panels.length : 0;

    return (
      <div className={classes}>
        <a className="dashboard-row__title pointer" onClick={this.toggle}>
          <i className={chevronClass} />
          {this.props.panel.title}
          <span className="dashboard-row__panel_count">({hiddenPanels} hidden panels)</span>
        </a>
        <div className="dashboard-row__actions">
          <a className="pointer" onClick={this.openSettings}>
            <i className="fa fa-cog" />
          </a>
        </div>
        <div className="dashboard-row__drag grid-drag-handle" />
      </div>
    );
  }
}
