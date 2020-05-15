import React from 'react';
import classNames from 'classnames';
import { Icon, ModalsController } from '@grafana/ui';
import { PanelModel } from '../../state/PanelModel';
import { DashboardModel } from '../../state/DashboardModel';
import templateSrv from 'app/features/templating/template_srv';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { RowOptionsModal } from '../RowOptions/RowOptionsModal';

export interface DashboardRowProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class DashboardRow extends React.Component<DashboardRowProps, any> {
  constructor(props: DashboardRowProps) {
    super(props);

    this.state = {
      collapsed: this.props.panel.collapsed,
    };

    this.props.dashboard.on(CoreEvents.templateVariableValueUpdated, this.onVariableUpdated);
  }

  componentWillUnmount() {
    this.props.dashboard.off(CoreEvents.templateVariableValueUpdated, this.onVariableUpdated);
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

  onUpdate = (hideModal: () => void) => (title: string | null, repeat: string | null) => {
    this.props.panel['title'] = title;
    this.props.panel['repeat'] = repeat;
    this.props.panel.render();
    this.props.dashboard.processRepeats();
    this.forceUpdate();
    hideModal();
  };

  onDelete = () => {
    appEvents.emit(CoreEvents.showConfirmModal, {
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
  };

  render() {
    const classes = classNames({
      'dashboard-row': true,
      'dashboard-row--collapsed': this.state.collapsed,
    });

    const title = templateSrv.replaceWithText(this.props.panel.title, this.props.panel.scopedVars);
    const count = this.props.panel.panels ? this.props.panel.panels.length : 0;
    const panels = count === 1 ? 'panel' : 'panels';
    const canEdit = this.props.dashboard.meta.canEdit === true;

    return (
      <div className={classes}>
        <a className="dashboard-row__title pointer" onClick={this.onToggle}>
          <Icon name={this.state.collapsed ? 'angle-right' : 'angle-down'} />
          {title}
          <span className="dashboard-row__panel_count">
            ({count} {panels})
          </span>
        </a>
        {canEdit && (
          <div className="dashboard-row__actions">
            <ModalsController>
              {({ showModal, hideModal }) => {
                return (
                  <a
                    className="pointer"
                    onClick={() => {
                      showModal(RowOptionsModal, {
                        title: this.props.panel.title,
                        repeat: this.props.panel.repeat,
                        onDismiss: hideModal,
                        onUpdate: this.onUpdate(hideModal),
                      });
                    }}
                  >
                    <Icon name="cog" />
                  </a>
                );
              }}
            </ModalsController>
            <a className="pointer" onClick={this.onDelete}>
              <Icon name="trash-alt" />
            </a>
          </div>
        )}
        {this.state.collapsed === true && (
          <div className="dashboard-row__toggle-target" onClick={this.onToggle}>
            &nbsp;
          </div>
        )}
        {canEdit && <div className="dashboard-row__drag grid-drag-handle" />}
      </div>
    );
  }
}
