import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { Tooltip } from '@grafana/ui';
import { PanelPlugin, PanelPluginMeta } from '@grafana/data';
import { AngularComponent, config } from '@grafana/runtime';

import { QueriesTab } from './QueriesTab';
import VisualizationTab from './VisualizationTab';
import { GeneralTab } from './GeneralTab';
import { AlertTab } from '../../alerting/AlertTab';
import { PanelModel } from '../state/PanelModel';
import { DashboardModel } from '../state/DashboardModel';
import { StoreState } from '../../../types';
import { PanelEditorTab, PanelEditorTabIds } from './state/reducers';
import { changePanelEditorTab, panelEditorCleanUp, refreshPanelEditor } from './state/actions';
import { getActiveTabAndTabs } from './state/selectors';

interface PanelEditorProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  angularPanel?: AngularComponent;
  onPluginTypeChange: (newType: PanelPluginMeta) => void;
  activeTab: PanelEditorTabIds;
  tabs: PanelEditorTab[];
  refreshPanelEditor: typeof refreshPanelEditor;
  panelEditorCleanUp: typeof panelEditorCleanUp;
  changePanelEditorTab: typeof changePanelEditorTab;
}

class UnConnectedPanelEditor extends PureComponent<PanelEditorProps> {
  constructor(props: PanelEditorProps) {
    super(props);
  }

  componentDidMount(): void {
    this.refreshFromState();
  }

  componentWillUnmount(): void {
    const { panelEditorCleanUp } = this.props;
    panelEditorCleanUp();
  }

  refreshFromState = (meta?: PanelPluginMeta) => {
    const { refreshPanelEditor, plugin } = this.props;
    meta = meta || plugin.meta;

    refreshPanelEditor({
      hasQueriesTab: !meta.skipDataQuery,
      usesGraphPlugin: meta.id === 'graph',
      alertingEnabled: config.alertingEnabled,
    });
  };

  onChangeTab = (tab: PanelEditorTab) => {
    const { changePanelEditorTab } = this.props;
    // Angular Query Components can potentially refresh the PanelModel
    // onBlur so this makes sure we change tab after that
    setTimeout(() => changePanelEditorTab(tab), 10);
  };

  onPluginTypeChange = (newType: PanelPluginMeta) => {
    const { onPluginTypeChange } = this.props;
    onPluginTypeChange(newType);

    this.refreshFromState(newType);
  };

  renderCurrentTab(activeTab: string) {
    const { panel, dashboard, plugin, angularPanel } = this.props;

    switch (activeTab) {
      case 'advanced':
        return <GeneralTab panel={panel} />;
      case 'queries':
        return <QueriesTab panel={panel} dashboard={dashboard} />;
      case 'alert':
        return <AlertTab angularPanel={angularPanel} dashboard={dashboard} panel={panel} />;
      case 'visualization':
        return (
          <VisualizationTab
            panel={panel}
            dashboard={dashboard}
            plugin={plugin}
            onPluginTypeChange={this.onPluginTypeChange}
            angularPanel={angularPanel}
          />
        );
      default:
        return null;
    }
  }

  render() {
    const { activeTab, tabs } = this.props;

    return (
      <div className="panel-editor-container__editor">
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

export const mapStateToProps = (state: StoreState) => getActiveTabAndTabs(state.location, state.panelEditor);

const mapDispatchToProps = { refreshPanelEditor, panelEditorCleanUp, changePanelEditorTab };

export const PanelEditor = hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UnConnectedPanelEditor)
);

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
      <a className={tabClasses} aria-label={`${tab.text} tab button`}>
        <Tooltip content={`${tab.text}`} placement="auto">
          <i className={`gicon gicon-${tab.id}${activeTab === tab.id ? '-active' : ''}`} />
        </Tooltip>
      </a>
    </div>
  );
}
