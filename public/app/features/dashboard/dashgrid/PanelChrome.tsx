import React, { ComponentClass } from 'react';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { PanelHeader } from './PanelHeader';
import { DataPanel, PanelProps } from './DataPanel';

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
  }

  render() {
    const { datasource, targets } = this.props.panel;
    const PanelComponent = this.props.component;

    // if (!PanelComponent) {
    //   PanelComponent = dataPanels[type] = DataPanelWrapper(this.props.component);
    // }

    console.log('PanelChrome render', PanelComponent);

    return (
      <div className="panel-container">
        <PanelHeader panel={this.props.panel} dashboard={this.props.dashboard} />
        <div className="panel-content">
          <DataPanel datasource={datasource} queries={targets}>
            {({ loading, data }) => {
              return <PanelComponent loading={loading} data={data} />;
            }}
          </DataPanel>
        </div>
      </div>
    );
  }
}
