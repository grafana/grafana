import React from 'react';
import { PanelModel } from '../panel_model';
import { PanelContainer } from './PanelContainer';
import { AttachedPanel } from './PanelLoader';
import { DashboardRow } from './DashboardRow';
import { AddPanelPanel } from './AddPanelPanel';
import { LazyLoader } from './LazyLoader';

export interface DashboardPanelProps {
  panel: PanelModel;
  lazy: boolean;
  getPanelContainer: () => PanelContainer;
}

export interface DashboardPanelState {
  load: boolean;
}

export class DashboardPanel extends React.Component<DashboardPanelProps, DashboardPanelState> {
  element: any;
  attachedPanel: AttachedPanel;

  constructor(props) {
    super(props);
    this.state = {
      load: !props.lazy,
    };
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }
    if (this.attachedPanel) {
      return; // already attached
    }

    const panel = this.props.panel;
    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();
    const loader = panelContainer.getPanelLoader();
    this.attachedPanel = loader.load(this.element, panel, dashboard);
    panel.lazyloading = false;
  }

  componentWillUnmount() {
    if (this.attachedPanel) {
      this.attachedPanel.destroy();
    }
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (!this.attachedPanel) {
      if (this.state.load) {
        this.componentDidMount();
        return;
      }

      // If the lazy state changed, then try to update
      if (!this.props.lazy) {
        this.setState({ load: true });
      }
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

    if (this.state.load) {
      return <div ref={element => (this.element = element)} className="panel-height-helper" />;
    }

    return <LazyLoader wrapper={this} />;
  }
}
