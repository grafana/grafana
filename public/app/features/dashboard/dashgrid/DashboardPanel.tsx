import React from 'react';
import { PanelModel } from '../panel_model';
import { PanelContainer } from './PanelContainer';
import { AttachedPanel } from './PanelLoader';
import { DashboardRow } from './DashboardRow';
import { AddPanelPanel } from './AddPanelPanel';
import { PANEL_VISIBILITY_CHANGED_EVENT } from './PanelObserver';

export interface DashboardPanelProps {
  panel: PanelModel;
  getPanelContainer: () => PanelContainer;
}

export interface DashboardPanelState {
  lazyLoading: boolean;
}

export class DashboardPanel extends React.Component<DashboardPanelProps, DashboardPanelState> {
  element: any;
  attachedPanel: AttachedPanel;

  constructor(props) {
    super(props);
    this.state = {
      lazyLoading: true,
    };
  }

  private checkAttachedElement() {
    if (!this.element) {
      return;
    }

    if (this.attachedPanel) {
      return; // already attached
    }

    if (!this.state.lazyLoading) {
      const panel = this.props.panel;
      const panelContainer = this.props.getPanelContainer();
      const dashboard = panelContainer.getDashboard();
      const loader = panelContainer.getPanelLoader();
      this.attachedPanel = loader.load(this.element, panel, dashboard);
    }
  }

  panelVisibilityChanged = vis => {
    //console.log('VISIBILITY Changed: ', vis, this.props.panel.title );
    if (this.element && vis && !this.attachedPanel && this.state.lazyLoading) {
      this.setState({ lazyLoading: false });
      console.log('Load (delayed): ', this.props.panel.id, this.props.panel.title);
    }
  };

  componentDidMount() {
    //console.log('DID Mount: ',this.props.panel.title, this.props.panel.visible );
    this.props.panel.events.on(PANEL_VISIBILITY_CHANGED_EVENT, this.panelVisibilityChanged);
    this.checkAttachedElement();
  }

  componentWillUnmount() {
    //console.log('Will Unmount: ',this.props.panel.title, this.props.panel.visible );
    this.props.panel.events.off(PANEL_VISIBILITY_CHANGED_EVENT, this.panelVisibilityChanged);
    if (this.attachedPanel) {
      this.attachedPanel.destroy();
      this.attachedPanel = null;
    }
    this.element = null;
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (!this.attachedPanel && !this.state.lazyLoading) {
      this.checkAttachedElement();
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

    // Spinner is distracting on load...
    // {this.state.lazyLoading === true && (
    //   <div>
    //     {/* This should never be visible */}
    //     <i className="fa fa-spinner fa-spin" /> {this.props.panel.title}...
    //   </div>
    // )}

    return (
      <div>
        <div ref={element => (this.element = element)} className="panel-height-helper" />
      </div>
    );
  }
}
