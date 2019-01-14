// Libraries
import React, { PureComponent } from 'react';

// Utils & Services
import { AngularComponent, getAngularLoader } from 'app/core/services/AngularLoader';

// Types
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

interface State {
}

export class VisualizationTab extends PureComponent<Props, State> {
  element: HTMLElement;
  angularQueryEditor: AngularComponent;

  constructor(props) {
    super(props);
  }

  render() {

  }
}
