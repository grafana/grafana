import React from 'react';
import classNames from 'classnames';

import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { store } from 'app/store/configureStore';
import { QueriesTab } from './QueriesTab';
import { PanelPlugin, PluginExports } from 'app/types/plugins';
import { VizTypePicker } from './VizTypePicker';
import { updateLocation } from 'app/core/actions';
import CustomScrollbar from 'app/core/components/CustomScrollbar/CustomScrollbar';

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
      { id: 'alert', text: 'Alert', icon: 'gicon gicon-alert' },
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
        <VizTypePicker currentType={this.props.panel.type} onTypeChanged={this.props.onTypeChanged} />
        {this.renderPanelOptions()}
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

  onClose = () => {
    store.dispatch(
      updateLocation({
        query: { tab: null, fullscreen: null, edit: null },
        partial: true,
      })
    );
  };

  render() {
    const { location } = store.getState();
    const activeTab = location.query.tab || 'queries';

    return (
      <div className="panel-editor-container__editor">
        <div className="panel-editor-resizer">
          <div className="panel-editor-resizer__handle">
            <div className="panel-editor-resizer__handle-dots" />
          </div>
        </div>
        <div className="panel-editor__aside">
          <h2 className="panel-editor__aside-header">
            <i className="fa fa-cog" />
            Edit Panel
          </h2>

          {this.tabs.map(tab => {
            return <TabItem tab={tab} activeTab={activeTab} onClick={this.onChangeTab} key={tab.id} />;
          })}

          <div className="panel-editor__aside-actions">
            <button className="btn btn-secondary" onClick={this.onClose}>
              Back to dashboard
            </button>
            <button className="btn btn-inverse" onClick={this.onClose}>
              Discard changes
            </button>
          </div>
        </div>
        <div className="panel-editor__content">
          <CustomScrollbar>
            {activeTab === 'queries' && this.renderQueriesTab()}
            {activeTab === 'visualization' && this.renderVizTab()}
          </CustomScrollbar>
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
    'panel-editor__aside-item': true,
    active: activeTab === tab.id,
  });

  return (
    <a className={tabClasses} onClick={() => onClick(tab)}>
      <i className={tab.icon} /> {tab.text}
    </a>
  );
}
