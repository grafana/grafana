import React from 'react';
import config from 'app/core/config';
import {PanelModel} from '../panel_model';
import {PanelContainer} from './PanelContainer';
import _ from 'lodash';

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
    return _.chain(config.panels)
      .filter({hideFromList: false})
      .map(item => item)
      .orderBy('sort')
      .value();
  }

  onPanelSelected(panelPluginInfo) {
    const panelContainer = this.props.getPanelContainer();
    const dashboard = panelContainer.getDashboard();

    // remove add-panel panel
    dashboard.removePanel(this.props.panel);

    dashboard.addPanel({
      type: panelPluginInfo.id,
      title: 'Panel Title',
      gridPos: {
        x: this.props.panel.gridPos.x,
        y: this.props.panel.gridPos.y,
        w: this.props.panel.gridPos.w,
        h: this.props.panel.gridPos.h
      }
    });
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
