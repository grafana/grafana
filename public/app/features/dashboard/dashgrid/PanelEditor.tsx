import React from 'react';
import classNames from 'classnames';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { store } from 'app/store/configureStore';
import { QueriesTab } from './QueriesTab';
import { PanelPlugin, PluginExports } from 'app/types/plugins';
import { VizTypePicker } from './VizTypePicker';
import { updateLocation } from 'app/core/actions';

interface PanelEditorProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  panelType: string;
  pluginExports: PluginExports;
  onTypeChanged: (newType: PanelPlugin) => void;
}

interface PanelEditorTab {
  id: string;
  text: string;
  icon: string;
}

export class PanelEditor extends React.Component<PanelEditorProps, any> {
  tabs: PanelEditorTab[];

  constructor(props) {
    super(props);

    this.tabs = [
      { id: 'queries', text: 'Queries', icon: 'fa fa-database' },
      { id: 'visualization', text: 'Visualization', icon: 'fa fa-line-chart' },
    ];
  }

  renderQueriesTab() {
    return <QueriesTab panel={this.props.panel} dashboard={this.props.dashboard} />;
  }

  renderPanelOptions() {
    const { pluginExports } = this.props;

    if (pluginExports.PanelOptions) {
      const PanelOptions = pluginExports.PanelOptions;
      return <PanelOptions />;
    } else {
      return <p>Visualization has no options</p>;
    }
  }

  renderVizTab() {
    return (
      <div className="viz-editor">
        <div className="viz-editor-col1">
          <VizTypePicker currentType={this.props.panel.type} onTypeChanged={this.props.onTypeChanged} />
        </div>
        <div className="viz-editor-col2">
          <h5 className="page-heading">Options</h5>
          {this.renderPanelOptions()}
        </div>
      </div>
    );
  }

  onChangeTab = (tab: PanelEditorTab) => {
    store.dispatch(
      updateLocation({
        query: { tab: tab.id },
        partial: true,
      })
    );
  };

  render() {
    const { location } = store.getState();
    const activeTab = location.query.tab || 'queries';

    return (
      <div className="tabbed-view tabbed-view--new">
        <div className="tabbed-view-header">
          <ul className="gf-tabs">
            {this.tabs.map(tab => {
              return <TabItem tab={tab} activeTab={activeTab} onClick={this.onChangeTab} key={tab.id} />;
            })}
          </ul>

          <button className="tabbed-view-close-btn" ng-click="ctrl.exitFullscreen();">
            <i className="fa fa-remove" />
          </button>
        </div>

        <div className="tabbed-view-body">
          {activeTab === 'queries' && this.renderQueriesTab()}
          {activeTab === 'visualization' && this.renderVizTab()}
        </div>
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
    <li className="gf-tabs-item" key={tab.id}>
      <a className={tabClasses} onClick={() => onClick(tab)}>
        <i className={tab.icon} /> {tab.text}
      </a>
    </li>
  );
}
