import React from 'react';
import _ from 'lodash';
import config from 'app/core/config';
import { PanelModel } from '../../panel_model';
import { DashboardModel } from '../../dashboard_model';
import store from 'app/core/store';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { updateLocation } from 'app/core/actions';
import { store as reduxStore } from 'app/store/store';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export interface State {
  copiedPanelPlugins: any[];
}

export class AddPanelWidget extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.handleCloseAddPanel = this.handleCloseAddPanel.bind(this);

    this.state = {
      copiedPanelPlugins: this.getCopiedPanelPlugins(),
    };
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

  onCreateNewPanel = () => {
    const dashboard = this.props.dashboard;
    const { gridPos } = this.props.panel;

    const newPanel: any = {
      type: 'graph',
      title: 'Panel Title',
      gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
    };

    dashboard.addPanel(newPanel);
    dashboard.removePanel(this.props.panel);

    this.moveToEdit(newPanel);
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
      newPanel.title = panelPluginInfo.defaults.title;
      store.delete(LS_PANEL_COPY_KEY);
    }

    dashboard.addPanel(newPanel);
    dashboard.removePanel(this.props.panel);
  };

  onCreateNewRow = () => {
    const dashboard = this.props.dashboard;

    const newRow: any = {
      type: 'row',
      title: 'Row title',
      gridPos: { x: 0, y: 0 },
    };

    dashboard.addPanel(newRow);
    dashboard.removePanel(this.props.panel);
  };

  render() {
    let addCopyButton;

    if (this.state.copiedPanelPlugins.length === 1) {
      addCopyButton = this.copyButton(this.state.copiedPanelPlugins[0]);
    }

    return (
      <div className="panel-container add-panel-widget-container">
        <div className="add-panel-widget">
          <div className="add-panel-widget__header grid-drag-handle">
            <i className="gicon gicon-add-panel" />
            <button className="add-panel-widget__close" onClick={this.handleCloseAddPanel}>
              <i className="fa fa-close" />
            </button>
          </div>
          <div className="add-panel-widget__btn-container">
            <button className="btn-success btn btn-large" onClick={this.onCreateNewPanel}>
              Edit Panel
            </button>
            {addCopyButton}
            <button className="btn-inverse btn" onClick={this.onCreateNewRow}>
              Add Row
            </button>
          </div>
        </div>
      </div>
    );
  }
}
