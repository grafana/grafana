import React from 'react';
import { useLocation } from 'react-router-dom';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObject, sceneGraph } from '@grafana/scenes';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { supportsDataQuery } from 'app/features/dashboard/components/PanelEditor/utils';

import { InspectTab } from '../../inspector/types';

import { findVizPanel } from './utils/findVizPanel';

interface ScenePanelInspectorState extends SceneObjectState {
  panelKey: string;
  tabs?: Array<SceneObject<InspectTabState>>;
}

export class ScenePanelInspector extends SceneObjectBase<ScenePanelInspectorState> {
  static Component = ScenePanelInspectorRenderer;

  constructor(state: ScenePanelInspectorState) {
    super(state);

    this.addActivationHandler(() => this.onActivate());
  }

  onActivate() {
    const panel = findVizPanel(this, this.state.panelKey)!;
    const plugin = panel.getPlugin();
    const tabs: Array<SceneObject<InspectTabState>> = [];

    if (!plugin) {
      return;
    }

    if (supportsDataQuery(plugin)) {
      tabs.push(new InspectDataTab());
      tabs.push(new InspectStatsTab());
    }

    this.setState({ tabs });
  }

  getDrawerTitle() {
    const panel = findVizPanel(this, this.state.panelKey)!;
    return sceneGraph.interpolate(this, `Inspect: ${panel.state.title}`);
  }

  onClose = () => {
    locationService.partial({ inspect: null });
  };
}

function ScenePanelInspectorRenderer({ model }: SceneComponentProps<ScenePanelInspector>) {
  const { tabs } = model.useState();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  if (!tabs) {
    return null;
  }

  const urlTab = queryParams.get('inspectTab');
  const currentTab = tabs.find((tab) => tab.state.value === urlTab) ?? tabs[0];

  return (
    <Drawer
      title={model.getDrawerTitle()}
      scrollableContent
      onClose={model.onClose}
      size="md"
      tabs={
        <TabsBar>
          {tabs.map((tab) => {
            return (
              <Tab
                key={tab.state.key!}
                label={tab.state.label}
                active={tab === currentTab}
                href={locationUtil.getUrlForPartial(location, { inspectTab: tab.state.value })}
              />
            );
          })}
        </TabsBar>
      }
    >
      {currentTab.Component && <currentTab.Component model={currentTab} />}
    </Drawer>
  );
}

interface InspectTabState extends SceneObjectState {
  label: string;
  value: InspectTab;
}

class InspectDataTab extends SceneObjectBase<InspectTabState> {
  constructor() {
    super({ label: t('dashboard.inspect.data-tab', 'Data'), value: InspectTab.Data });
  }

  static Component = ({ model }: SceneComponentProps<InspectDataTab>) => {
    return <div>Data tab</div>;
  };
}

class InspectStatsTab extends SceneObjectBase<InspectTabState> {
  constructor() {
    super({ label: t('dashboard.inspect.stats-tab', 'Stats'), value: InspectTab.Stats });
  }

  static Component = ({ model }: SceneComponentProps<InspectStatsTab>) => {
    return <div>Stats tab</div>;
  };
}
