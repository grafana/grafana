import React from 'react';
import _ from 'lodash';

import config from 'app/core/config';
import {PanelModel} from '../panel_model';
import {PanelContainer} from './PanelContainer';
import ScrollBar from 'app/core/components/ScrollBar/ScrollBar';

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

    this.state = {
      panelPlugins: this.getPanelPlugins(),
      filter: '',
    };

    this.onPanelSelected = this.onPanelSelected.bind(this);
  }

  getPanelPlugins() {
    let panels = _.chain(config.panels)
      .filter({hideFromList: false})
      .map(item => item)
      .value();

    // add special row type
    panels.push({id: 'row', name: 'Row', sort: 8, info: {logos: {small: 'public/img/icn-row.svg'}}});

    // add sort by sort property
    return _.sortBy(panels, 'sort');
  }

  onPanelSelected(panelPluginInfo) {
    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();
    const {gridPos} = this.props.panel;

    var newPanel: any = {
      type: panelPluginInfo.id,
      title: 'Panel Title',
      gridPos: {x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h}
    };

    if (panelPluginInfo.id === 'row') {
      newPanel.title = 'Row title';
      newPanel.gridPos = {x: 0, y: 0};
    }

    dashboard.addPanel(newPanel);
    dashboard.removePanel(this.props.panel);
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
            <i className="gicon gicon-add-panel"></i>
            <span className="add-panel__title">New Panel</span>
            <span className="add-panel__sub-title">Select a visualization</span>
          </div>
          <ScrollBar className="add-panel__items">
            {this.state.panelPlugins.map(this.renderPanelItem.bind(this))}
          </ScrollBar>
        </div>
      </div>
    );
  }
}

