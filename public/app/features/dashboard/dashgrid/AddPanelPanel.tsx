import React from 'react';
import _ from 'lodash';

import config from 'app/core/config';
import { PanelModel } from '../panel_model';
import { PanelContainer } from './PanelContainer';
import ScrollBar from 'app/core/components/ScrollBar/ScrollBar';

export interface AddPanelPanelProps {
  panel: PanelModel;
  getPanelContainer: () => PanelContainer;
}

export interface AddPanelPanelState {
  filter: string;
  panelPlugins: any[];
  clipboardPanel: any;
}

export class AddPanelPanel extends React.Component<AddPanelPanelProps, AddPanelPanelState> {
  constructor(props) {
    super(props);

    this.state = {
      panelPlugins: this.getPanelPlugins(),
      clipboardPanel: this.getClipboardPanel(),
      filter: '',
    };

    this.onPanelSelected = this.onPanelSelected.bind(this);
    this.onClipboardPanelSelected = this.onClipboardPanelSelected.bind(this);
  }

  getPanelPlugins() {
    let panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();

    // add special row type
    panels.push({ id: 'row', name: 'Row', sort: 8, info: { logos: { small: 'public/img/icn-row.svg' } } });

    // add sort by sort property
    return _.sortBy(panels, 'sort');
  }

  getClipboardPanel() {
    return this.props.getPanelContainer().getClipboardPanel();
  }

  onPanelSelected(panelPluginInfo) {
    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();
    const { gridPos } = this.props.panel;

    var newPanel: any = {
      type: panelPluginInfo.id,
      title: 'Panel Title',
      gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
    };

    if (panelPluginInfo.id === 'row') {
      newPanel.title = 'Row title';
      newPanel.gridPos = { x: 0, y: 0 };
    }

    dashboard.addPanel(newPanel);
    dashboard.removePanel(this.props.panel);
  }

  onClipboardPanelSelected(panel) {
    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();

    const { gridPos } = this.props.panel;
    panel.gridPos.x = gridPos.x;
    panel.gridPos.y = gridPos.y;

    dashboard.addPanel(panel);
    dashboard.removePanel(this.props.panel);
  }

  renderClipboardPanel(copiedPanel) {
    const panel = copiedPanel.panel;
    const title = `Paste copied panel '${panel.title}' from '${copiedPanel.dashboard}'`;

    return (
      <div className="add-panel__item" onClick={() => this.onClipboardPanelSelected(panel)} title={title}>
        <div className="add-panel__item-icon">
          <i className="fa fa-paste fa-2x fa-fw" />
        </div>
        <div className="add-panel__item-name">Paste copied panel</div>
      </div>
    );
  }

  renderPanelItem(panel) {
    return (
      <div key={panel.id} className="add-panel__item" onClick={() => this.onPanelSelected(panel)} title={panel.name}>
        <img className="add-panel__item-img" src={panel.info.logos.small} />
        <div className="add-panel__item-name">{panel.name}</div>
      </div>
    );
  }

  render() {
    return (
      <div className="panel-container">
        <div className="add-panel">
          <div className="add-panel__header">
            <i className="gicon gicon-add-panel" />
            <span className="add-panel__title">New Panel</span>
            <span className="add-panel__sub-title">Select a visualization</span>
          </div>
          <ScrollBar className="add-panel__items">
            {this.state.clipboardPanel && this.renderClipboardPanel(this.state.clipboardPanel)}
            {this.state.panelPlugins.map(this.renderPanelItem.bind(this))}
          </ScrollBar>
        </div>
      </div>
    );
  }
}
