import React from 'react';
import _ from 'lodash';

import config from 'app/core/config';
import {PanelModel} from '../panel_model';
import {PanelContainer} from './PanelContainer';
import {GRID_COLUMN_COUNT} from 'app/core/constants';

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
    panels.push({id: 'row', name: 'Row', sort: 8, info: {logos: {small: 'public/img/icn-panel.svg'}}});

    // add sort by sort property
    return _.sortBy(panels, 'sort');
  }

  onPanelSelected(panelPluginInfo) {
    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();
    const {gridPos} = this.props.panel;

    // remove add-panel panel
    dashboard.removePanel(this.props.panel);

    var newPanel: any = {
      type: panelPluginInfo.id,
      title: 'Panel Title',
      gridPos: {x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h}
    };

    if (panelPluginInfo.id === 'row') {
      newPanel.title = 'Row title';
      newPanel.gridPos = {x: 0, y: 0, w: GRID_COLUMN_COUNT, h: 1, static: true};
    }

    dashboard.addPanel(newPanel);
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
        <div className="add-panel">{this.state.panelPlugins.map(this.renderPanelItem.bind(this))}</div>
      </div>
    );
  }
}
