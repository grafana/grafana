import React, { PureComponent } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { DashboardModel } from '../../state/DashboardModel';

interface Props {
  dashboard: DashboardModel;
}

export class GeneralSettings extends PureComponent<Props> {
  render() {
    return (
      <h3 className="dashboard-settings__header" aria-label={selectors.pages.Dashboard.Settings.General.title}>
        General
      </h3>
    );
  }
}
