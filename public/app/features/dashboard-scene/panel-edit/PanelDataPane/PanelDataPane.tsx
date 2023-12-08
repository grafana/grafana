import React from 'react';
import { Unsubscribable } from 'rxjs';

import {
  SceneComponentProps,
  SceneDataTransformer,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import { shouldShowAlertingTab } from 'app/features/dashboard/components/PanelEditor/state/selectors';

import { VizPanelManager } from '../VizPanelManager';

import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { PanelDataPaneTab } from './types';

export interface PanelDataPaneState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanelManager>;
  tabs?: PanelDataPaneTab[];
  tab?: string;
}

export class PanelDataPane extends SceneObjectBase<PanelDataPaneState> {
  static Component = PanelDataPaneRendered;
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['tab'] });
  private _initialTabsBuilt = false;
  private panelSubscription: Unsubscribable | undefined;

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
    const panelManager = panelRef.resolve();
    const panel = panelManager.state.panel;

    if (panel) {
      // The subscription below is needed because the plugin may not be loaded when this pane is mounted.
      // This can happen i.e. when the user opens the panel editor directly via an URL.
      this._subs.add(
        panelManager.subscribeToState((n, p) => {
          if (n.panel !== p.panel) {
            this.buildTabs();
            this.setupPanelSubscription(n.panel);
          }
        })
      );

      this.setupPanelSubscription(panel);
    }

    this.addActivationHandler(() => () => {
      this.buildTabs();
      return () => {
        if (this.panelSubscription) {
          this.panelSubscription.unsubscribe();
          this.panelSubscription = undefined;
        }
      };
    });
  }

  private setupPanelSubscription(panel: VizPanel) {
    if (this.panelSubscription) {
      this._initialTabsBuilt = false;
      this.panelSubscription.unsubscribe();
    }

    this.panelSubscription = panel.subscribeToState((n, p) => {
      if (panel.getPlugin() && !this._initialTabsBuilt) {
        this.buildTabs();
        this._initialTabsBuilt = true;
      }
    });
  }
  private getDataObjects(): [SceneQueryRunner | undefined, SceneDataTransformer | undefined] {
    const { panelRef } = this.state;
    const dataObj = sceneGraph.getData(panelRef.resolve().state.panel);

    let runner: SceneQueryRunner | undefined;
    let transformer: SceneDataTransformer | undefined;

    if (dataObj instanceof SceneQueryRunner) {
      runner = dataObj;
    }

    if (dataObj instanceof SceneDataTransformer) {
      transformer = dataObj;
      if (transformer.state.$data instanceof SceneQueryRunner) {
        runner = transformer.state.$data;
      }
    }

    //TODO: handle ShareQueryDataProvider

    return [runner, transformer];
  }

  private buildTabs() {
    const { panelRef } = this.state;
    const panelManager = panelRef.resolve();
    const panel = panelManager.state.panel;
    const [runner, transformer] = this.getDataObjects();
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
          tabs.push(new PanelDataQueriesTab({ panelRef: panel.getRef(), dataRef: new SceneObjectRef(runner) }));
        }

        if (transformer) {
          tabs.push(
            new PanelDataTransformationsTab({ panelRef: panel.getRef(), dataRef: new SceneObjectRef(transformer) })
          );
        }

        if (shouldShowAlertingTab(plugin)) {
          tabs.push(new PanelDataAlertingTab({ panelRef: panel.getRef() }));
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
