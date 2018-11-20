import React, { PureComponent } from 'react';
import classNames from 'classnames';

import { QueriesTab } from './QueriesTab';
import { VisualizationTab } from './VisualizationTab';
import { GeneralTab } from './GeneralTab';
import { AlertTab } from './AlertTab';

import config from 'app/core/config';
import { store } from 'app/store/store';
import { updateLocation } from 'app/core/actions';
import { AngularComponent } from 'app/core/services/AngularLoader';

import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { PanelPlugin } from 'app/types/plugins';

interface PanelEditorProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  angularPanel?: AngularComponent;
  onTypeChanged: (newType: PanelPlugin) => void;
}

interface PanelEditorTab {
  id: string;
  text: string;
  icon: string;
}

export class PanelEditor extends PureComponent<PanelEditorProps> {
  constructor(props) {
    super(props);
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

  renderCurrentTab(activeTab: string) {
    const { panel, dashboard, onTypeChanged, plugin, angularPanel } = this.props;

    switch (activeTab) {
      case 'general':
        return <GeneralTab panel={panel} />;
      case 'queries':
        return <QueriesTab panel={panel} dashboard={dashboard} />;
      case 'alert':
        return <AlertTab angularPanel={angularPanel} />;
      case 'visualization':
        return (
          <VisualizationTab
            panel={panel}
            dashboard={dashboard}
            plugin={plugin}
            onTypeChanged={onTypeChanged}
            angularPanel={angularPanel}
          />
        );
      default:
        return null;
    }
  }

  render() {
    const { plugin } = this.props;
    const activeTab = store.getState().location.query.tab || 'queries';

    const tabs = [
      { id: 'general', text: 'General', icon: 'gicon gicon-preferences' },
      { id: 'queries', text: 'Queries', icon: 'fa fa-database' },
      { id: 'visualization', text: 'Visualization', icon: 'fa fa-line-chart' },
    ];

    if (config.alertingEnabled && plugin.id === 'graph') {
      tabs.push({
        id: 'alert',
        text: 'Alert',
        icon: 'gicon gicon-alert',
      });
    }

    return (
      <div className="panel-editor-container__editor">
        <div className="panel-editor-resizer">
          <div className="panel-editor-resizer__handle">
            <div className="panel-editor-resizer__handle-dots" />
          </div>
        </div>

        <div className="panel-editor-tabs">
          <ul className="gf-tabs">
            {tabs.map(tab => {
              return <TabItem tab={tab} activeTab={activeTab} onClick={this.onChangeTab} key={tab.id} />;
            })}
          </ul>
        </div>
        {this.renderCurrentTab(activeTab)}
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
