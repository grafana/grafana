import React from 'react';
import _ from 'lodash';
import classNames from 'classnames';
import config from 'app/core/config';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import ScrollBar from 'app/core/components/ScrollBar/ScrollBar';
import store from 'app/core/store';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import Highlighter from 'react-highlight-words';

export interface AddPanelPanelProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export interface AddPanelPanelState {
  filter: string;
  panelPlugins: any[];
  copiedPanelPlugins: any[];
  tab: string;
}

export class AddPanelPanel extends React.Component<AddPanelPanelProps, AddPanelPanelState> {
  private scrollbar: ScrollBar;

  constructor(props) {
    super(props);
    this.handleCloseAddPanel = this.handleCloseAddPanel.bind(this);
    this.renderPanelItem = this.renderPanelItem.bind(this);
    this.panelSizeChanged = this.panelSizeChanged.bind(this);

    this.state = {
      panelPlugins: this.getPanelPlugins(''),
      copiedPanelPlugins: this.getCopiedPanelPlugins(''),
      filter: '',
      tab: 'Add',
    };
  }

  componentDidMount() {
    this.props.panel.events.on('panel-size-changed', this.panelSizeChanged);
  }

  componentWillUnmount() {
    this.props.panel.events.off('panel-size-changed', this.panelSizeChanged);
  }

  panelSizeChanged() {
    setTimeout(() => {
      this.scrollbar.update();
    });
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
    const panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();
    let copiedPanels = [];

    const copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
    if (copiedPanelJson) {
      const copiedPanel = JSON.parse(copiedPanelJson);
      const pluginInfo = _.find(panels, { id: copiedPanel.type });
      if (pluginInfo) {
        const pluginCopy = _.cloneDeep(pluginInfo);
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
    const dashboard = this.props.dashboard;
    const { gridPos } = this.props.panel;

    const newPanel: any = {
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
    this.props.dashboard.removePanel(this.props.dashboard.panels[0]);
  }

  renderText(text: string) {
    const searchWords = this.state.filter.split('');
    return <Highlighter highlightClassName="highlight-search-match" textToHighlight={text} searchWords={searchWords} />;
  }

  renderPanelItem(panel, index) {
    return (
      <div key={index} className="add-panel__item" onClick={() => this.onAddPanel(panel)} title={panel.name}>
        <img className="add-panel__item-img" src={panel.info.logos.small} />
        <div className="add-panel__item-name">{this.renderText(panel.name)}</div>
      </div>
    );
  }

  noCopiedPanelPlugins() {
    return <div className="add-panel__no-panels">No copied panels yet.</div>;
  }

  filterChange(evt) {
    this.setState({
      filter: evt.target.value,
      panelPlugins: this.getPanelPlugins(evt.target.value),
      copiedPanelPlugins: this.getCopiedPanelPlugins(evt.target.value),
    });
  }

  filterKeyPress(evt) {
    if (evt.key === 'Enter') {
      const panel = _.head(this.state.panelPlugins);
      if (panel) {
        this.onAddPanel(panel);
      }
    }
  }

  filterPanels(panels, filter) {
    const regex = new RegExp(filter, 'i');
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
    const addClass = classNames({
      'active active--panel': this.state.tab === 'Add',
      '': this.state.tab === 'Copy',
    });

    const copyClass = classNames({
      '': this.state.tab === 'Add',
      'active active--panel': this.state.tab === 'Copy',
    });

    let panelTab;

    if (this.state.tab === 'Add') {
      panelTab = this.state.panelPlugins.map(this.renderPanelItem);
    } else if (this.state.tab === 'Copy') {
      if (this.state.copiedPanelPlugins.length > 0) {
        panelTab = this.state.copiedPanelPlugins.map(this.renderPanelItem);
      } else {
        panelTab = this.noCopiedPanelPlugins();
      }
    }

    return (
      <div className="panel-container add-panel-container">
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
                  Paste
                </div>
              </li>
            </ul>
            <button className="add-panel__close" onClick={this.handleCloseAddPanel}>
              <i className="fa fa-close" />
            </button>
          </div>
          <ScrollBar ref={element => (this.scrollbar = element)} className="add-panel__items">
            <div className="add-panel__searchbar">
              <label className="gf-form gf-form--grow gf-form--has-input-icon">
                <input
                  type="text"
                  autoFocus
                  className="gf-form-input gf-form--grow"
                  placeholder="Panel Search Filter"
                  value={this.state.filter}
                  onChange={this.filterChange.bind(this)}
                  onKeyPress={this.filterKeyPress.bind(this)}
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
