import React from 'react';
import _ from 'lodash';
import config from 'app/core/config';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import ScrollBar from 'app/core/components/ScrollBar/ScrollBar';
import store from 'app/core/store';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import Highlighter from 'react-highlight-words';
import { updateLocation } from 'app/core/actions';
import { store as reduxStore } from 'app/store/store';

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
    this.panelSizeChanged = this.panelSizeChanged.bind(this);

    this.state = {
      panelPlugins: this.getPanelPlugins(),
      copiedPanelPlugins: this.getCopiedPanelPlugins(),
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

  getPanelPlugins() {
    const panelsList = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();

    const panels = [];

    for (let i = 0; i < panelsList.length; i++) {
      if (panelsList[i].id === 'graph') {
        panels.push(panelsList[i]);
      }
    }
    // add special row type
    panels.push({ id: 'row', name: 'Row', sort: 8, info: { logos: { small: 'public/img/icn-row.svg' } } });
    // add sort by sort property
    return panels;
  }

  getCopiedPanelPlugins() {
    const panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();
    const copiedPanels = [];

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
    return _.sortBy(copiedPanels, 'sort');
  }

  handleCloseAddPanel(evt) {
    evt.preventDefault();
    this.props.dashboard.removePanel(this.props.dashboard.panels[0]);
  }

  renderText(text: string) {
    const searchWords = this.state.filter.split('');
    return <Highlighter highlightClassName="highlight-search-match" textToHighlight={text} searchWords={searchWords} />;
  }

  noCopiedPanelPlugins() {
    return <div className="add-panel__no-panels">No copied panels yet.</div>;
  }

  copyButton(panel) {
    return (
      <button className="btn-inverse btn" onClick={() => this.onPasteCopiedPanel(panel)} title={panel.name}>
        Paste copied Panel
      </button>
    );
  }

  moveToEdit(panel) {
    reduxStore.dispatch(
      updateLocation({
        query: {
          panelId: panel.id,
          edit: true,
          fullscreen: true,
        },
        partial: true,
      })
    );
  }

  onCreateNewPanel = panelPluginInfo => {
    const dashboard = this.props.dashboard;
    const { gridPos } = this.props.panel;

    const newPanel: any = {
      type: panelPluginInfo.id,
      title: 'Panel Title',
      gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
    };

    // apply panel template / defaults
    if (panelPluginInfo.defaults) {
      _.defaults(newPanel, panelPluginInfo.defaults);
      newPanel.gridPos.w = panelPluginInfo.defaults.gridPos.w;
      newPanel.gridPos.h = panelPluginInfo.defaults.gridPos.h;
      newPanel.title = panelPluginInfo.defaults.title;
      store.delete(LS_PANEL_COPY_KEY);
    }

    dashboard.addPanel(newPanel);
    this.moveToEdit(newPanel);

    dashboard.removePanel(this.props.panel);
  };

  onPasteCopiedPanel = panelPluginInfo => {
    const dashboard = this.props.dashboard;
    const { gridPos } = this.props.panel;

    const newPanel: any = {
      type: panelPluginInfo.id,
      title: 'Panel Title',
      gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
    };

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

  onCreateNewRow = panelPluginInfo => {
    const dashboard = this.props.dashboard;

    const newRow: any = {
      type: panelPluginInfo.id,
      title: 'Row title',
      gridPos: { x: 0, y: 0 },
    };

    dashboard.addPanel(newRow);
    dashboard.removePanel(this.props.panel);
  };

  render() {
    const panel = this.state.panelPlugins[0];
    const row = this.state.panelPlugins[1];

    let addCopyButton;

    if (this.state.copiedPanelPlugins.length === 1) {
      addCopyButton = this.copyButton(this.state.copiedPanelPlugins[0]);
    }

    return (
      <div className="panel-container add-panel-container">
        <div className="add-panel">
          <div className="add-panel__header">
            <i className="gicon gicon-add-panel" />
            <button className="add-panel__close" onClick={this.handleCloseAddPanel}>
              <i className="fa fa-close" />
            </button>
          </div>
          <div className="add-panel-btn-container">
            <div className="gf-form-button-row">
              <button className="btn-success btn" onClick={() => this.onCreateNewPanel(panel)} title={panel.name}>
                Create new Panel
              </button>
              {addCopyButton}
              <button className="btn-inverse btn" onClick={() => this.onCreateNewRow(row)} title={row.name}>
                Add new Row
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
