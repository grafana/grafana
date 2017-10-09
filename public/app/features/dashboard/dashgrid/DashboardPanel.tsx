import React from 'react';

export interface DashboardPanelProps {
  panel: any;
}

export class DashboardPanel extends React.Component<DashboardPanelProps, any> {
  private element: any;

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
  }

  render() {
    return (
      <div ref={element => this.element = element} />
    );
  }
}

