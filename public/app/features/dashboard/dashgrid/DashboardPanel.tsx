import React from 'react';
import {PanelModel} from '../panel_model';
import {PanelContainer} from './PanelContainer';
import {AttachedPanel} from './PanelLoader';

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
    return (
      <div ref={element => this.element = element} />
    );
  }
}

