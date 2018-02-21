import React from 'react';
import _ from 'lodash';

import config from 'app/core/config';
import { PanelModel } from '../panel_model';
import { PanelContainer } from './PanelContainer';
import ScrollBar from 'app/core/components/ScrollBar/ScrollBar';
import store from 'app/core/store';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import Highlighter from 'react-highlight-words';

export interface AddPanelPanelProps {
  panel: PanelModel;
  getPanelContainer: () => PanelContainer;
}

export interface AddPanelPanelState {
  filter: string;
  panelPlugins: any[];
  copiedPanelPlugins: any[];
  tab: string;
}

export class AddPanelPanel extends React.Component<AddPanelPanelProps, AddPanelPanelState> {
  constructor(props) {
    super(props);
    this.handleCloseAddPanel = this.handleCloseAddPanel.bind(this);
    this.renderPanelItem = this.renderPanelItem.bind(this);

    this.state = {
      panelPlugins: this.getPanelPlugins(''),
      copiedPanelPlugins: this.getCopiedPanelPlugins(''),
      filter: '',
      tab: 'Add',
    };
  }

  getPanelPlugins(filter) {
    let panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();

    // add special row type
    panels.push({ id: 'row', name: 'Row', sort: 8, info: { logos: { small: 'public/img/icn-row.svg' } } });

    panels = this.filterPanels(panels, filter);

    // add sort by sort property
    return _.sortBy(panels, 'sort');
  }

  getCopiedPanelPlugins(filter) {
    let panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();
    let copiedPanels = [];

    let copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
    if (copiedPanelJson) {
      let copiedPanel = JSON.parse(copiedPanelJson);
      let pluginInfo = _.find(panels, { id: copiedPanel.type });
      if (pluginInfo) {
        let pluginCopy = _.cloneDeep(pluginInfo);
        pluginCopy.name = copiedPanel.title;
        pluginCopy.sort = -1;
        pluginCopy.defaults = copiedPanel;
        copiedPanels.push(pluginCopy);
      }
    }

    copiedPanels = this.filterPanels(copiedPanels, filter);

    return _.sortBy(copiedPanels, 'sort');
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

  renderText(text: string) {
    //if(this.state.filter) {
    let searchWords = this.state.filter.split('');
    return <Highlighter highlightClassName="highlight-search-match" textToHighlight={text} searchWords={searchWords} />;
    //}
    //return text;
  }

  renderPanelItem(panel, index) {
    return (
      <div key={index} className="add-panel__item" onClick={() => this.onAddPanel(panel)} title={panel.name}>
        <img className="add-panel__item-img" src={panel.info.logos.small} />
        <div className="add-panel__item-name">{this.renderText(panel.name)}</div>
      </div>
    );
  }

  filterChange(evt) {
    this.setState({
      filter: evt.target.value,
      panelPlugins: this.getPanelPlugins(evt.target.value),
      copiedPanelPlugins: this.getCopiedPanelPlugins(evt.target.value),
    });
  }

  filterPanels(panels, filter) {
    let regex = new RegExp(filter, 'i');
    return panels.filter(panel => {
      return regex.test(panel.name);
    });
  }

  openCopy() {
    this.setState({
      tab: 'Copy',
      filter: '',
      panelPlugins: this.getPanelPlugins(''),
      copiedPanelPlugins: this.getCopiedPanelPlugins(''),
    });
  }

  openAdd() {
    this.setState({
      tab: 'Add',
      filter: '',
      panelPlugins: this.getPanelPlugins(''),
      copiedPanelPlugins: this.getCopiedPanelPlugins(''),
    });
  }

  render() {
    let addClass;
    let copyClass;
    let panelTab;

    if (this.state.tab === 'Add') {
      addClass = 'active active--panel';
      copyClass = '';
      panelTab = this.state.panelPlugins.map(this.renderPanelItem);
    } else if (this.state.tab === 'Copy') {
      addClass = '';
      copyClass = 'active active--panel';
      panelTab = this.state.copiedPanelPlugins.map(this.renderPanelItem);
    }

    return (
      <div className="panel-container">
        <div className="add-panel">
          <div className="add-panel__header">
            <i className="gicon gicon-add-panel" />
            <span className="add-panel__title">New Panel</span>
            <ul className="gf-tabs">
              <li className="gf-tabs-item">
                <div className={'gf-tabs-link pointer ' + addClass} onClick={this.openAdd.bind(this)}>
                  Add
                </div>
              </li>
              <li className="gf-tabs-item">
                <div className={'gf-tabs-link pointer ' + copyClass} onClick={this.openCopy.bind(this)}>
                  Copy
                </div>
              </li>
            </ul>
            <button className="add-panel__close" onClick={this.handleCloseAddPanel}>
              <i className="fa fa-close" />
            </button>
          </div>
          <ScrollBar className="add-panel__items">
            <div className="add-panel__searchbar">
              <label className="gf-form gf-form--grow gf-form--has-input-icon">
                <input
                  type="text"
                  className="gf-form-input max-width-20"
                  placeholder="Panel Search Filter"
                  value={this.state.filter}
                  onChange={this.filterChange.bind(this)}
                />
                <i className="gf-form-input-icon fa fa-search" />
              </label>
            </div>
            {panelTab}
          </ScrollBar>
        </div>
      </div>
    );
  }
}
