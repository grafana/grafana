import React from 'react';
import {PanelLoader} from './PanelLoader';

export interface DashboardPanelProps {
  panel: any;
  dashboard: any;
  getPanelLoader: () => PanelLoader;
}

export class DashboardPanel extends React.Component<DashboardPanelProps, any> {
  private element: any;

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    var loader = this.props.getPanelLoader();
    loader.load(this.element, this.props.panel, this.props.dashboard);
  }

  render() {
    return (
      <div ref={element => this.element = element} />
    );
  }
}

