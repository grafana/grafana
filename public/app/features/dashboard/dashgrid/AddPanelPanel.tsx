import React from 'react';
import _ from 'lodash';

import config from 'app/core/config';
import { PanelModel } from '../panel_model';
import { PanelContainer } from './PanelContainer';
import ScrollBar from 'app/core/components/ScrollBar/ScrollBar';
import store from 'app/core/store';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';

export interface AddPanelPanelProps {
  panel: PanelModel;
  getPanelContainer: () => PanelContainer;
}

export interface AddPanelPanelState {
  filter: string;
  panelPlugins: any[];
}

export class AddPanelPanel extends React.Component<AddPanelPanelProps, AddPanelPanelState> {
  constructor(props) {
    super(props);
    this.handleCloseAddPanel = this.handleCloseAddPanel.bind(this);
    this.renderPanelItem = this.renderPanelItem.bind(this);

    this.state = {
      panelPlugins: this.getPanelPlugins(),
      filter: '',
    };
  }

  getPanelPlugins() {
    let panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();

    // add special row type
    panels.push({ id: 'row', name: 'Row', sort: 8, info: { logos: { small: 'public/img/icn-row.svg' } } });

    let copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
    if (copiedPanelJson) {
      let copiedPanel = JSON.parse(copiedPanelJson);
      let pluginInfo = _.find(panels, { id: copiedPanel.type });
      if (pluginInfo) {
        let pluginCopy = _.cloneDeep(pluginInfo);
        pluginCopy.name = copiedPanel.title;
        pluginCopy.sort = -1;
        pluginCopy.defaults = copiedPanel;
        panels.push(pluginCopy);
      }
    }

    // add sort by sort property
    return _.sortBy(panels, 'sort');
  }

  onAddPanel = panelPluginInfo => {
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

    // apply panel template / defaults
    if (panelPluginInfo.defaults) {
      _.defaults(newPanel, panelPluginInfo.defaults);
      newPanel.gridPos.w = panelPluginInfo.defaults.gridPos.w;
      newPanel.gridPos.h = panelPluginInfo.defaults.gridPos.h;
      newPanel.title = panelPluginInfo.defaults.title;
      store.delete(LS_PANEL_COPY_KEY);
    }

    dashboard.addPanel(newPanel);
    dashboard.removePanel(this.props.panel);
  };

  handleCloseAddPanel(evt) {
    evt.preventDefault();
    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();
    dashboard.removePanel(dashboard.panels[0]);
  }

  renderPanelItem(panel, index) {
    return (
      <div key={index} className="add-panel__item" onClick={() => this.onAddPanel(panel)} title={panel.name}>
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
            <button className="add-panel__close" onClick={this.handleCloseAddPanel}>
              <i className="fa fa-close" />
            </button>
          </div>
          <ScrollBar className="add-panel__items">{this.state.panelPlugins.map(this.renderPanelItem)}</ScrollBar>
        </div>
      </div>
    );
  }
}
