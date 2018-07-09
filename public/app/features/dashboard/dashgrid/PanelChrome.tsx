import React, { ComponentClass } from 'react';
import $ from 'jquery';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { PanelHeader } from './PanelHeader';
import { DataPanel, PanelProps, DataPanelWrapper } from './DataPanel';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  component: ComponentClass<PanelProps>;
}

interface State {}

export class PanelChrome extends React.Component<Props, State> {
  panelComponent: DataPanel;

  constructor(props) {
    super(props);

    this.panelComponent = DataPanelWrapper(this.props.component);
  }

  componentDidMount() {
    console.log('panel chrome mounted');
  }

  render() {
    let PanelComponent = this.panelComponent;

    return (
      <div className="panel-container">
        <PanelHeader panel={this.props.panel} dashboard={this.props.dashboard} />
        <div className="panel-content">{<PanelComponent type={'test'} queries={[]} isVisible={true} />}</div>
      </div>
    );
  }
}
