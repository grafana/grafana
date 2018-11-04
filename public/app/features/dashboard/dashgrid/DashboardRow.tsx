import React from 'react';
import classNames from 'classnames';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import templateSrv from 'app/features/templating/template_srv';
import appEvents from 'app/core/app_events';

export interface DashboardRowProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class DashboardRow extends React.Component<DashboardRowProps, any> {
  constructor(props) {
    super(props);

    this.state = {
      collapsed: this.props.panel.collapsed,
    };

    this.toggle = this.toggle.bind(this);
    this.openSettings = this.openSettings.bind(this);
    this.delete = this.delete.bind(this);
    this.update = this.update.bind(this);
  }

  toggle() {
    this.props.dashboard.toggleRow(this.props.panel);

    this.setState(prevState => {
      return { collapsed: !prevState.collapsed };
    });
  }

  update() {
    this.props.dashboard.processRepeats();
    this.forceUpdate();
  }

  openSettings() {
    appEvents.emit('show-modal', {
      templateHtml: `<row-options row="model.row" on-updated="model.onUpdated()" dismiss="dismiss()"></row-options>`,
      modalClass: 'modal--narrow',
      model: {
        row: this.props.panel,
        onUpdated: this.update.bind(this),
      },
    });
  }

  delete() {
    appEvents.emit('confirm-modal', {
      title: 'Delete Row',
      text: 'Are you sure you want to remove this row and all its panels?',
      altActionText: 'Delete row only',
      icon: 'fa-trash',
      onConfirm: () => {
        this.props.dashboard.removeRow(this.props.panel, true);
      },
      onAltAction: () => {
        this.props.dashboard.removeRow(this.props.panel, false);
      },
    });
  }

  render() {
    const classes = classNames({
      'dashboard-row': true,
      'dashboard-row--collapsed': this.state.collapsed,
    });
    const chevronClass = classNames({
      fa: true,
      'fa-chevron-down': !this.state.collapsed,
      'fa-chevron-right': this.state.collapsed,
    });

    const title = templateSrv.replaceWithText(this.props.panel.title, this.props.panel.scopedVars);
    const count = this.props.panel.panels ? this.props.panel.panels.length : 0;
    const panels = count === 1 ? 'panel' : 'panels';
    const canEdit = this.props.dashboard.meta.canEdit === true;

    return (
      <div className={classes}>
        <a className="dashboard-row__title pointer" onClick={this.toggle}>
          <i className={chevronClass} />
          {title}
          <span className="dashboard-row__panel_count">
            ({count} {panels})
          </span>
        </a>
        {canEdit && (
          <div className="dashboard-row__actions">
            <a className="pointer" onClick={this.openSettings}>
              <i className="fa fa-cog" />
            </a>
            <a className="pointer" onClick={this.delete}>
              <i className="fa fa-trash" />
            </a>
          </div>
        )}
        {this.state.collapsed === true && (
          <div className="dashboard-row__toggle-target" onClick={this.toggle}>
            &nbsp;
          </div>
        )}
        {canEdit && <div className="dashboard-row__drag grid-drag-handle" />}
      </div>
    );
  }
}
