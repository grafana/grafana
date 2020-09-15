import React, { PureComponent } from 'react';
import { Button, Modal, HorizontalGroup, VerticalGroup, Icon } from '@grafana/ui';
import { css } from 'emotion';
import { dashboardWatcher } from './dashboardWatcher';
import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DashboardEvent, DashboardUpdateMode } from './types';

interface Props {
  event?: DashboardEvent;
}

interface State {
  dismiss?: boolean;
  mode: DashboardUpdateMode;
  modeChanged?: boolean;
}

export class DashboardWatcherSettings extends PureComponent<Props, State> {
  state: State = {
    mode: DashboardUpdateMode.Ask,
  };

  modes: Array<SelectableValue<DashboardUpdateMode>> = [
    { value: DashboardUpdateMode.Ask, label: 'Ask', description: 'show this modal when the dashboad changes' },
    { value: DashboardUpdateMode.Ignore, label: 'Ignore', description: 'any bacground dashboards update' },
    { value: DashboardUpdateMode.AutoUpdate, label: 'Auto update', description: 'refresh the dashboard' },
    { value: DashboardUpdateMode.ShowNotice, label: 'Show notice', description: 'add a notifiction to the screen' },
  ];

  onDismiss = () => {
    this.setState({ dismiss: true });
  };

  setMode = (mode: DashboardUpdateMode) => {
    this.setState({ mode, modeChanged: true });
  };

  reloadDashboard = () => {
    dashboardWatcher.reloadPage();
    this.onDismiss();
  };

  saveMode = () => {
    const { mode } = this.state;
    dashboardWatcher.saveSettings({
      updateMode: mode,
    });

    if (this.state.mode === DashboardUpdateMode.AutoUpdate) {
      this.reloadDashboard();
    } else {
      this.onDismiss();
    }
  };

  render() {
    const { mode, dismiss, modeChanged } = this.state;
    const radioClass = css`
      cursor: pointer;
      width: 100%;
      padding: 4px;

      &:hover {
        background: ${config.theme.colors.formCheckboxBgCheckedHover};
      }
    `;

    return (
      <Modal
        isOpen={!!!dismiss}
        title="Dashboard Changed"
        icon="copy"
        onDismiss={this.onDismiss}
        className={css`
          width: 500px;
        `}
      >
        <div>
          <div>This dashboard has been modifed by another session</div>
          <div>What should we do?</div>
          <br />
          <VerticalGroup>
            {this.modes.map(opt => {
              return (
                <div key={opt.value} onClick={() => this.setMode(opt.value!)} className={radioClass}>
                  <Icon name={mode === opt.value ? 'check-circle' : 'circle'} />
                  &nbsp;
                  <b>{opt.label}</b>
                  &nbsp; -- &nbsp;
                  {opt.description}
                </div>
              );
            })}
          </VerticalGroup>
          <br />
          <br />

          <HorizontalGroup>
            <Button onClick={this.reloadDashboard} variant="primary">
              Reload dashboard
            </Button>
            <Button onClick={this.saveMode} variant={modeChanged ? 'primary' : 'secondary'}>
              Save Preference
            </Button>
            <Button onClick={this.onDismiss} variant="secondary">
              Ignore
            </Button>
          </HorizontalGroup>
        </div>
      </Modal>
    );
  }
}
