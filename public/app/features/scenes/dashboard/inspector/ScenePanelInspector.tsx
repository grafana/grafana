import React from 'react';
import { useLocation } from 'react-router-dom';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObject,
  sceneGraph,
  VizPanel,
} from '@grafana/scenes';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { supportsDataQuery } from 'app/features/dashboard/components/PanelEditor/utils';

import { InspectDataTab } from './InspectDataTab';
import { InspectStatsTab } from './InspectStatsTab';
import { InspectTabState } from './types';

interface ScenePanelInspectorState extends SceneObjectState {
  tabs?: Array<SceneObject<InspectTabState>>;
}

export class ScenePanelInspector extends SceneObjectBase<ScenePanelInspectorState> {
  static Component = ScenePanelInspectorRenderer;
  // Not stored in state as this is just a reference and it never changes
  private _panel: VizPanel;

  constructor(panel: VizPanel) {
    super({});

    this._panel = panel;
    this.buildTabs();
  }

  buildTabs() {
    const plugin = this._panel.getPlugin();
    const tabs: Array<SceneObject<InspectTabState>> = [];

    if (!plugin) {
      // TODO handle this case
      return;
    }

    if (supportsDataQuery(plugin)) {
      tabs.push(new InspectDataTab(this._panel));
      tabs.push(new InspectStatsTab(this._panel));
    }

    this.setState({ tabs });
  }

  getDrawerTitle() {
    return sceneGraph.interpolate(this._panel, `Inspect: ${this._panel.state.title}`);
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
