import React from 'react';

import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import { shouldShowAlertingTab } from 'app/features/dashboard/components/PanelEditor/state/selectors';

import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { PanelDataPaneTab } from './types';

export interface PanelDataPaneState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  tabs?: PanelDataPaneTab[];
  tab?: string;
}

export class PanelDataPane extends SceneObjectBase<PanelDataPaneState> {
  static Component = PanelDataPaneRendered;
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['tab'] });

  getUrlState() {
    return {
      tab: this.state.tab,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (!values.tab) {
      return;
    }
    if (typeof values.tab === 'string') {
      this.setState({ tab: values.tab });
    }
  }

  constructor(state: Omit<PanelDataPaneState, 'tab'> & { tab?: string }) {
    super({
      tab: 'queries',
      ...state,
    });

    const { panelRef } = this.state;
    const panel = panelRef.resolve();

    if (panel) {
      // The subscription below is needed because the plugin may not be loaded when this pane is mounted.
      // This can happen i.e. when the user opens the panel editor directly via an URL.
      this._subs.add(
        panel.subscribeToState((n, p) => {
          if (n.pluginVersion || p.pluginId !== n.pluginId) {
            this.buildTabs();
          }
        })
      );
    }

    this.addActivationHandler(() => this.buildTabs());
  }

  private buildTabs() {
    const { panelRef } = this.state;
    const tabs: PanelDataPaneTab[] = [];

    if (panelRef) {
      const plugin = panelRef.resolve().getPlugin();
      if (!plugin) {
        this.setState({ tabs });
        return;
      }
      if (plugin.meta.skipDataQuery) {
        this.setState({ tabs });
        return;
      } else {
        tabs.push(new PanelDataQueriesTab({}));
        tabs.push(new PanelDataTransformationsTab({}));

        if (shouldShowAlertingTab(plugin)) {
          tabs.push(new PanelDataAlertingTab({}));
        }
      }
    }

    this.setState({ tabs });
  }

  onChangeTab = (tab: PanelDataPaneTab) => {
    this.setState({ tab: tab.tabId });
  };
}

function PanelDataPaneRendered({ model }: SceneComponentProps<PanelDataPane>) {
  const { tab, tabs } = model.useState();

  if (!tabs) {
    return;
  }

  const currentTab = tabs.find((t) => t.tabId === tab);

  return (
    <div>
      <TabsBar hideBorder={true}>
        {tabs.map((t, index) => {
          return (
            <Tab
              key={`${t.getTabLabel()}-${index}`}
              label={t.getTabLabel()}
              icon={t.icon}
              //   suffix={}
              active={t.tabId === tab}
              onChangeTab={() => model.onChangeTab(t)}
            />
          );
        })}
      </TabsBar>
      <TabContent>{currentTab && <currentTab.Component model={currentTab} />}</TabContent>
    </div>
  );
}
