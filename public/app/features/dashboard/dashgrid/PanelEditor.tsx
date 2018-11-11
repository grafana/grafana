import React, { PureComponent } from 'react';
import classNames from 'classnames';

import { QueriesTab } from './QueriesTab';
import { VisualizationTab } from './VisualizationTab';

import { store } from 'app/store/configureStore';
import { updateLocation } from 'app/core/actions';

import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { PanelPlugin } from 'app/types/plugins';

interface PanelEditorProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  onTypeChanged: (newType: PanelPlugin) => void;
}

interface PanelEditorTab {
  id: string;
  text: string;
  icon: string;
}

export class PanelEditor extends PureComponent<PanelEditorProps> {
  tabs: PanelEditorTab[];

  constructor(props) {
    super(props);

    this.tabs = [
      { id: 'queries', text: 'Queries', icon: 'fa fa-database' },
      { id: 'visualization', text: 'Visualization', icon: 'fa fa-line-chart' },
      { id: 'alert', text: 'Alert', icon: 'gicon gicon-alert' },
    ];
  }

  onChangeTab = (tab: PanelEditorTab) => {
    store.dispatch(
      updateLocation({
        query: { tab: tab.id },
        partial: true,
      })
    );
    this.forceUpdate();
  };

  onClose = () => {
    store.dispatch(
      updateLocation({
        query: { tab: null, fullscreen: null, edit: null },
        partial: true,
      })
    );
  };

  render() {
    const { panel, dashboard, onTypeChanged, plugin } = this.props;
    const { location } = store.getState();
    const activeTab = location.query.tab || 'queries';

    return (
      <div className="panel-editor-container__editor">
        <div className="panel-editor-resizer">
          <div className="panel-editor-resizer__handle">
            <div className="panel-editor-resizer__handle-dots" />
          </div>
        </div>

        <div className="panel-editor-tabs">
          <ul className="gf-tabs">
            {this.tabs.map(tab => {
              return <TabItem tab={tab} activeTab={activeTab} onClick={this.onChangeTab} key={tab.id} />;
            })}
          </ul>

          <button className="panel-editor-tabs__close" onClick={this.onClose}>
            <i className="fa fa-reply" />
          </button>
        </div>

        {activeTab === 'queries' && <QueriesTab panel={panel} dashboard={dashboard} />}
        {activeTab === 'visualization' && (
          <VisualizationTab panel={panel} dashboard={dashboard} plugin={plugin} onTypeChanged={onTypeChanged} />
        )}
      </div>
    );
  }
}

interface TabItemParams {
  tab: PanelEditorTab;
  activeTab: string;
  onClick: (tab: PanelEditorTab) => void;
}

function TabItem({ tab, activeTab, onClick }: TabItemParams) {
  const tabClasses = classNames({
    'gf-tabs-link': true,
    active: activeTab === tab.id,
  });

  return (
    <li className="gf-tabs-item" onClick={() => onClick(tab)}>
      <a className={tabClasses}>
        <i className={tab.icon} /> {tab.text}
      </a>
    </li>
  );
}
