import React, { ComponentClass } from 'react';
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

// cache DataPanel wrapper components
const dataPanels: { [s: string]: DataPanel } = {};

export class PanelChrome extends React.Component<Props, State> {
  panelComponent: DataPanel;

  constructor(props) {
    super(props);
  }

  render() {
    const { type } = this.props.panel;

    let PanelComponent = dataPanels[type];

    if (!PanelComponent) {
      PanelComponent = dataPanels[type] = DataPanelWrapper(this.props.component);
    }

    console.log('PanelChrome render', PanelComponent);

    return (
      <div className="panel-container">
        <PanelHeader panel={this.props.panel} dashboard={this.props.dashboard} />
        <div className="panel-content">{<PanelComponent type={'test'} queries={[]} isVisible={true} />}</div>
      </div>
    );
  }
}
