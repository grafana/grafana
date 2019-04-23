// Libraries
import React from 'react';
import _ from 'lodash';

// Utils
import config from 'app/core/config';
import store from 'app/core/store';

// Store
import { store as reduxStore } from 'app/store/store';
import { updateLocation } from 'app/core/actions';

// Types
import { PanelModel } from '../../state';
import { DashboardModel } from '../../state';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { LocationUpdate } from 'app/types';

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
      const pluginInfo: any = _.find(panels, { id: copiedPanel.type });
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

  onCreateNewPanel = (tab = 'queries') => {
    const dashboard = this.props.dashboard;
    const { gridPos } = this.props.panel;

    const newPanel: any = {
      type: 'graph',
      title: 'Panel Title',
      gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
    };

    dashboard.addPanel(newPanel);
    dashboard.removePanel(this.props.panel);

    const location: LocationUpdate = {
      query: {
        panelId: newPanel.id,
        edit: true,
        fullscreen: true,
      },
      partial: true,
    };

    if (tab === 'visualization') {
      location.query.tab = 'visualization';
      location.query.openVizPicker = true;
    }

    reduxStore.dispatch(updateLocation(location));
  };

  onPasteCopiedPanel = panelPluginInfo => {
    const dashboard = this.props.dashboard;
    const { gridPos } = this.props.panel;

    const newPanel: any = {
      type: panelPluginInfo.id,
      title: 'Panel Title',
      gridPos: {
        x: gridPos.x,
        y: gridPos.y,
        w: panelPluginInfo.defaults.gridPos.w,
        h: panelPluginInfo.defaults.gridPos.h,
      },
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

  renderOptionLink = (icon, text, onClick) => {
    return (
      <div>
        <a href="#" onClick={onClick} className="add-panel-widget__link btn btn-inverse">
          <div className="add-panel-widget__icon">
            <i className={`gicon gicon-${icon}`} />
          </div>
          <span>{text}</span>
        </a>
      </div>
    );
  };

  render() {
    const { copiedPanelPlugins } = this.state;

    return (
      <div className="panel-container add-panel-widget-container">
        <div className="add-panel-widget">
          <div className="add-panel-widget__header grid-drag-handle">
            <i className="gicon gicon-add-panel" />
            <span className="add-panel-widget__title">New Panel</span>
            <button className="add-panel-widget__close" onClick={this.handleCloseAddPanel}>
              <i className="fa fa-close" />
            </button>
          </div>
          <div className="add-panel-widget__btn-container">
            <div className="add-panel-widget__create">
              {this.renderOptionLink('queries', 'Add Query', this.onCreateNewPanel)}
              {this.renderOptionLink('visualization', 'Choose Visualization', () =>
                this.onCreateNewPanel('visualization')
              )}
            </div>
            <div className="add-panel-widget__actions">
              <button className="btn btn-inverse add-panel-widget__action" onClick={this.onCreateNewRow}>
                Convert to row
              </button>
              {copiedPanelPlugins.length === 1 && (
                <button
                  className="btn btn-inverse add-panel-widget__action"
                  onClick={() => this.onPasteCopiedPanel(copiedPanelPlugins[0])}
                >
                  Paste copied panel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
