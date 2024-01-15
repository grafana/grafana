import React from 'react';
import { Unsubscribable } from 'rxjs';

import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import { shouldShowAlertingTab } from 'app/features/dashboard/components/PanelEditor/state/selectors';

import { VizPanelManager } from '../VizPanelManager';

import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { PanelDataPaneTab } from './types';

export interface PanelDataPaneState extends SceneObjectState {
  tabs?: PanelDataPaneTab[];
  tab?: string;
}

export class PanelDataPane extends SceneObjectBase<PanelDataPaneState> {
  static Component = PanelDataPaneRendered;
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['tab'] });
  private _initialTabsBuilt = false;
  private panelSubscription: Unsubscribable | undefined;
  public panelManager: VizPanelManager;

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

  constructor(panelMgr: VizPanelManager) {
    super({
      tab: 'queries',
    });

    this.panelManager = panelMgr;
    this.addActivationHandler(() => this.onActivate());
  }

  private onActivate() {
    const panel = this.panelManager.state.panel;
    this.setupPanelSubscription(panel);
    this.buildTabs();

    this._subs.add(
      // Setup subscription for the case when panel type changed
      this.panelManager.subscribeToState((n, p) => {
        if (n.panel !== p.panel) {
          this.buildTabs();
          this.setupPanelSubscription(n.panel);
        }
      })
    );

    return () => {
      if (this.panelSubscription) {
        this.panelSubscription.unsubscribe();
        this.panelSubscription = undefined;
      }
    };
  }

  private setupPanelSubscription(panel: VizPanel) {
    if (this.panelSubscription) {
      this._initialTabsBuilt = false;
      this.panelSubscription.unsubscribe();
    }

    this.panelSubscription = panel.subscribeToState(() => {
      if (panel.getPlugin() && !this._initialTabsBuilt) {
        this.buildTabs();
        this._initialTabsBuilt = true;
      }
    });
  }

  private buildTabs() {
    const panelManager = this.panelManager;
    const panel = panelManager.state.panel;
    const runner = this.panelManager.queryRunner;
    const tabs: PanelDataPaneTab[] = [];

    if (panel) {
      const plugin = panel.getPlugin();

      if (!plugin) {
        this.setState({ tabs });
        return;
      }

      if (plugin.meta.skipDataQuery) {
        this.setState({ tabs });
        return;
      } else {
        if (runner) {
          tabs.push(new PanelDataQueriesTab(this.panelManager));
        }

        tabs.push(new PanelDataTransformationsTab(this.panelManager));

        if (shouldShowAlertingTab(plugin)) {
          tabs.push(new PanelDataAlertingTab(this.panelManager));
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
              counter={t.getItemsCount?.()}
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
