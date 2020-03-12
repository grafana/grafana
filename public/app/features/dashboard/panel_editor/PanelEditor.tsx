import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { Tooltip } from '@grafana/ui';
import { PanelPlugin, PanelPluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { e2e } from '@grafana/e2e';

import { QueriesTab } from './QueriesTab';
import VisualizationTab from './VisualizationTab';
import { GeneralTab } from './GeneralTab';
import { AlertTab } from '../../alerting/AlertTab';
import { PanelModel } from '../state/PanelModel';
import { DashboardModel } from '../state/DashboardModel';
import { StoreState } from '../../../types';
import { panelEditorCleanUp, PanelEditorTab, PanelEditorTabIds } from './state/reducers';
import { changePanelEditorTab, refreshPanelEditor } from './state/actions';
import { changePanelPlugin } from '../state/actions';
import { getActiveTabAndTabs } from './state/selectors';

interface PanelEditorProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  activeTab: PanelEditorTabIds;
  tabs: PanelEditorTab[];
  refreshPanelEditor: typeof refreshPanelEditor;
  panelEditorCleanUp: typeof panelEditorCleanUp;
  changePanelEditorTab: typeof changePanelEditorTab;
  changePanelPlugin: typeof changePanelPlugin;
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
    this.props.changePanelPlugin(this.props.panel, newType.id);
    this.refreshFromState(newType);
  };

  renderCurrentTab(activeTab: string) {
    const { panel, dashboard, plugin } = this.props;
    switch (activeTab) {
      case 'advanced':
        return <GeneralTab panel={panel} />;
      case 'queries':
        return <QueriesTab panel={panel} dashboard={dashboard} />;
      case 'alert':
        return <AlertTab dashboard={dashboard} panel={panel} />;
      case 'visualization':
        return (
          <VisualizationTab
            panel={panel}
            dashboard={dashboard}
            plugin={plugin}
            onPluginTypeChange={this.onPluginTypeChange}
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

const mapStateToProps = (state: StoreState) => getActiveTabAndTabs(state.location, state.panelEditor);
const mapDispatchToProps = { refreshPanelEditor, panelEditorCleanUp, changePanelEditorTab, changePanelPlugin };

export const PanelEditor = connect(mapStateToProps, mapDispatchToProps)(UnConnectedPanelEditor);

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
      <a className={tabClasses} aria-label={e2e.pages.Dashboard.Panels.EditPanel.selectors.tabItems(tab.text)}>
        <Tooltip content={`${tab.text}`} placement="auto">
          <i className={`gicon gicon-${tab.id}${activeTab === tab.id ? '-active' : ''}`} />
        </Tooltip>
      </a>
    </div>
  );
}
