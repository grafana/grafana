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
  SceneObjectRef,
} from '@grafana/scenes';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { supportsDataQuery } from 'app/features/dashboard/components/PanelEditor/utils';
import { InspectTab } from 'app/features/inspector/types';

import { InspectDataTab } from './InspectDataTab';
import { InspectJsonTab } from './InspectJsonTab';
import { InspectStatsTab } from './InspectStatsTab';
import { InspectTabState } from './types';

interface PanelInspectDrawerState extends SceneObjectState {
  tabs?: Array<SceneObject<InspectTabState>>;
  panelRef: SceneObjectRef<VizPanel>;
}

export class PanelInspectDrawer extends SceneObjectBase<PanelInspectDrawerState> {
  static Component = PanelInspectRenderer;

  constructor(state: PanelInspectDrawerState) {
    super(state);

    this.buildTabs();
  }

  buildTabs() {
    const panelRef = this.state.panelRef;
    const panel = panelRef.resolve();
    const plugin = panel.getPlugin();
    const tabs: Array<SceneObject<InspectTabState>> = [];

    if (plugin) {
      if (supportsDataQuery(plugin)) {
        tabs.push(
          new InspectDataTab({ panelRef, label: t('dashboard.inspect.data-tab', 'Data'), value: InspectTab.Data })
        );
        tabs.push(
          new InspectStatsTab({ panelRef, label: t('dashboard.inspect.stats-tab', 'Stats'), value: InspectTab.Stats })
        );
      }
    }

    tabs.push(new InspectJsonTab({ panelRef, label: t('dashboard.inspect.json-tab', 'JSON'), value: InspectTab.JSON }));

    this.setState({ tabs });
  }

  getDrawerTitle() {
    const panel = this.state.panelRef.resolve();
    return sceneGraph.interpolate(panel, `Inspect: ${panel.state.title}`);
  }

  onClose = () => {
    locationService.partial({ inspect: null, inspectTab: null });
  };
}

function PanelInspectRenderer({ model }: SceneComponentProps<PanelInspectDrawer>) {
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
      size="lg"
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
