import classNames from 'classnames';
import React from 'react';
import { Unsubscribable } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { getTemplateSrv, RefreshEvent } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import appEvents from 'app/core/app_events';

import { ShowConfirmModalEvent } from '../../../../types/events';
import { DashboardModel } from '../../state/DashboardModel';
import { PanelModel } from '../../state/PanelModel';
import { RowOptionsButton } from '../RowOptions/RowOptionsButton';

export interface DashboardRowProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class DashboardRow extends React.Component<DashboardRowProps, any> {
  sub?: Unsubscribable;
  constructor(props: DashboardRowProps) {
    super(props);

    this.state = {
      collapsed: this.props.panel.collapsed,
    };
  }

  componentDidMount() {
    this.sub = this.props.dashboard.events.subscribe(RefreshEvent, this.onVariableUpdated);
  }

  componentWillUnmount() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  onVariableUpdated = () => {
    this.forceUpdate();
  };

  onToggle = () => {
    this.props.dashboard.toggleRow(this.props.panel);

    this.setState((prevState: any) => {
      return { collapsed: !prevState.collapsed };
    });
  };

  onUpdate = (title: string, repeat?: string | null) => {
    this.props.panel.setProperty('title', title);
    this.props.panel.setProperty('repeat', repeat ?? undefined);
    this.props.panel.render();
    this.props.dashboard.processRepeats();
    this.forceUpdate();
  };

  onDelete = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete row',
        text: 'Are you sure you want to remove this row and all its panels?',
        altActionText: 'Delete row only',
        icon: 'trash-alt',
        onConfirm: () => {
          this.props.dashboard.removeRow(this.props.panel, true);
        },
        onAltAction: () => {
          this.props.dashboard.removeRow(this.props.panel, false);
        },
      })
    );
  };

  render() {
    const classes = classNames({
      'dashboard-row': true,
      'dashboard-row--collapsed': this.state.collapsed,
    });

    const title = getTemplateSrv().replace(this.props.panel.title, this.props.panel.scopedVars, 'text');
    const count = this.props.panel.panels ? this.props.panel.panels.length : 0;
    const panels = count === 1 ? 'panel' : 'panels';
    const canEdit = this.props.dashboard.meta.canEdit === true;

    return (
      <div className={classes} data-testid="dashboard-row-container">
        <a
          className="dashboard-row__title pointer"
          data-testid={selectors.components.DashboardRow.title(title)}
          onClick={this.onToggle}
        >
          <Icon name={this.state.collapsed ? 'angle-right' : 'angle-down'} />
          {title}
          <span className="dashboard-row__panel_count">
            ({count} {panels})
          </span>
        </a>
        {canEdit && (
          <div className="dashboard-row__actions">
            <RowOptionsButton
              title={this.props.panel.title}
              repeat={this.props.panel.repeat}
              onUpdate={this.onUpdate}
            />
            <a className="pointer" onClick={this.onDelete} role="button" aria-label="Delete row">
              <Icon name="trash-alt" />
            </a>
          </div>
        )}
        {this.state.collapsed === true && (
          <div className="dashboard-row__toggle-target" onClick={this.onToggle}>
            &nbsp;
          </div>
        )}
        {canEdit && <div data-testid="dashboard-row-drag" className="dashboard-row__drag grid-drag-handle" />}
      </div>
    );
  }
}
