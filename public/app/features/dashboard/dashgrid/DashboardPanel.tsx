import React from 'react';
import {PanelModel} from '../panel_model';
import {PanelContainer} from './PanelContainer';
import {AttachedPanel} from './PanelLoader';
import {DashboardRow} from './DashboardRow';
import {AddPanelPanel} from './AddPanelPanel';

export interface DashboardPanelProps {
  panel: PanelModel;
  getPanelContainer: () => PanelContainer;
}

export class DashboardPanel extends React.Component<DashboardPanelProps, any> {
  element: any;
  attachedPanel: AttachedPanel;

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }

    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();
    const loader = panelContainer.getPanelLoader();
    this.attachedPanel = loader.load(this.element, this.props.panel, dashboard);
  }

  componentWillUnmount() {
    if (this.attachedPanel) {
      this.attachedPanel.destroy();
    }
  }

  render() {
    // special handling for rows
    if (this.props.panel.type === 'row') {
      return <DashboardRow panel={this.props.panel} getPanelContainer={this.props.getPanelContainer} />;
    }

    if (this.props.panel.type === 'add-panel') {
      return <AddPanelPanel panel={this.props.panel} getPanelContainer={this.props.getPanelContainer} />;
    }

    return (
      <div ref={element => this.element = element} className="panel-height-helper" />
    );
  }
}

