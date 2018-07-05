import React, { ComponentClass } from 'react';
import $ from 'jquery';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';
import { PanelHeader } from './PanelHeader';
import { PanelEditor } from './PanelEditor';
import { DataPanel, PanelProps, DataPanelWrapper } from './DataPanel';

const TITLE_HEIGHT = 27;
const PANEL_BORDER = 2;

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  component: ComponentClass<PanelProps>;
}

interface State {
  height: number;
}

export class PanelChrome extends React.Component<Props, State> {
  panelComponent: DataPanel;

  constructor(props) {
    super(props);

    this.state = {
      height: this.getPanelHeight(),
    };

    this.panelComponent = DataPanelWrapper(this.props.component);
    this.props.panel.events.on('panel-size-changed', this.onPanelSizeChanged);
  }

  onPanelSizeChanged = () => {
    this.setState({
      height: this.getPanelHeight(),
    });
  };

  componentDidMount() {
    console.log('panel chrome mounted');
  }

  render() {
    let PanelComponent = this.panelComponent;

    return (
      <div className="panel-height-helper">
        <div className="panel-container">
          <PanelHeader panel={this.props.panel} dashboard={this.props.dashboard} />
          <div className="panel-content" style={{ height: this.state.height }}>
            {<PanelComponent type={'test'} queries={[]} isVisible={true} />}
          </div>
        </div>
        {this.props.panel.isEditing && <PanelEditor panel={this.props.panel} dashboard={this.props.dashboard} />}
      </div>
    );
  }

  getPanelHeight() {
    const panel = this.props.panel;
    let height = 0;

    if (panel.fullscreen) {
      var docHeight = $(window).height();
      var editHeight = Math.floor(docHeight * 0.3);
      var fullscreenHeight = Math.floor(docHeight * 0.8);
      height = panel.isEditing ? editHeight : fullscreenHeight;
    } else {
      height = panel.gridPos.h * GRID_CELL_HEIGHT + (panel.gridPos.h - 1) * GRID_CELL_VMARGIN;
    }

    return height - PANEL_BORDER + TITLE_HEIGHT;
  }
}
