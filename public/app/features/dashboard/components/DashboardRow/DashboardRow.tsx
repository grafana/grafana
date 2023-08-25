import classNames from 'classnames';
import { indexOf } from 'lodash';
import React from 'react';
import { Unsubscribable } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { getTemplateSrv, RefreshEvent } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/types';

import { ShowConfirmModalEvent } from '../../../../types/events';
import { DashboardModel } from '../../state/DashboardModel';
import { PanelModel } from '../../state/PanelModel';
import { RowOptionsButton } from '../RowOptions/RowOptionsButton';

export interface DashboardRowProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class DashboardRow extends React.Component<DashboardRowProps> {
  sub?: Unsubscribable;

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
  };

  getWarningMessage = () => {
    const panels = !!this.props.panel.panels?.length
      ? this.props.panel.panels
      : this.props.dashboard.getRowPanels(indexOf(this.props.dashboard.panels, this.props.panel));
    const isAnyPanelUsingDashboardDS = panels.some((p) => p.datasource?.uid === SHARED_DASHBOARD_QUERY);
    if (isAnyPanelUsingDashboardDS) {
      return `Panels in this row use the ${SHARED_DASHBOARD_QUERY} data source. These panels will reference the panel in the original row, not the ones in the repeated rows.`;
    }

    return undefined;
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
      'dashboard-row--collapsed': this.props.panel.collapsed,
    });

    const title = getTemplateSrv().replace(this.props.panel.title, this.props.panel.scopedVars, 'text');
    const count = this.props.panel.panels ? this.props.panel.panels.length : 0;
    const panels = count === 1 ? 'panel' : 'panels';
    const canEdit = this.props.dashboard.meta.canEdit === true;

    return (
      <div className={classes} data-testid="dashboard-row-container">
        <button
          className="dashboard-row__title pointer"
          type="button"
          data-testid={selectors.components.DashboardRow.title(title)}
          onClick={this.onToggle}
        >
          <Icon name={this.props.panel.collapsed ? 'angle-right' : 'angle-down'} />
          {title}
          <span className="dashboard-row__panel_count">
            ({count} {panels})
          </span>
        </button>
        {canEdit && (
          <div className="dashboard-row__actions">
            <RowOptionsButton
              title={this.props.panel.title}
              repeat={this.props.panel.repeat}
              onUpdate={this.onUpdate}
              warningMessage={this.getWarningMessage()}
            />
            <button type="button" className="pointer" onClick={this.onDelete} aria-label="Delete row">
              <Icon name="trash-alt" />
            </button>
          </div>
        )}
        {this.props.panel.collapsed === true && (
          /* disabling the a11y rules here as the button handles keyboard interactions */
          /* this is just to provide a better experience for mouse users */
          /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
          <div className="dashboard-row__toggle-target" onClick={this.onToggle}>
            &nbsp;
          </div>
        )}
        {canEdit && <div data-testid="dashboard-row-drag" className="dashboard-row__drag grid-drag-handle" />}
      </div>
    );
  }
}
