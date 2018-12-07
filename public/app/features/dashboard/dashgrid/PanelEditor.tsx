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

import Tooltip from 'app/core/components/Tooltip/Tooltip';

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
      case 'advanced':
        return <GeneralTab panel={panel} />;
      case 'queries':
        return <QueriesTab panel={panel} dashboard={dashboard} />;
      case 'alerts':
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
      { id: 'queries', text: 'Queries' },
      { id: 'visualization', text: 'Visualization' },
      { id: 'advanced', text: 'Panel Options' },
    ];

    if (config.alertingEnabled && plugin.id === 'graph') {
      tabs.push({
        id: 'alerts',
        text: 'Alerts',
      });
    }

    return (
      <div className="panel-editor-container__editor">
        {
          // <div className="panel-editor__close">
          //   <i className="fa fa-arrow-left" />
          // </div>
          // <div className="panel-editor-resizer">
          //   <div className="panel-editor-resizer__handle">
          //     <div className="panel-editor-resizer__handle-dots" />
          //   </div>
          // </div>
        }

        <div className="panel-editor-tabs">
          {tabs.map(tab => {
            return <TabItem tab={tab} activeTab={activeTab} onClick={this.onChangeTab} key={tab.id} />;
          })}
        </div>
        <div className="panel-editor__right">{this.renderCurrentTab(activeTab)}</div>
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
    'panel-editor-tabs__link': true,
    active: activeTab === tab.id,
  });

  return (
    <div className="panel-editor-tabs__item" onClick={() => onClick(tab)}>
      <a className={tabClasses}>
        <Tooltip content={`${tab.text}`} className="popper__manager--block" placement="auto">
          <i className={`gicon gicon-${tab.id}${activeTab === tab.id ? '-active' : ''}`} />
        </Tooltip>
      </a>
    </div>
  );
}
