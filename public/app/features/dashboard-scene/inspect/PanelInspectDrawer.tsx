import { type DataSourceApi, LoadingState, type PanelData } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectState,
  sceneGraph,
  type VizPanel,
  type SceneObjectRef,
} from '@grafana/scenes';
import { Alert, Drawer, Tab, TabsBar } from '@grafana/ui';
import {
  getDataSourceWithInspector,
  getDataSourceWithErrorsAndNoticesInspector,
  hasErrorsOrNotices,
} from 'app/features/dashboard/components/Inspector/hooks';
import { supportsDataQuery } from 'app/features/dashboard/components/PanelEditor/utils';
import { InspectTab } from 'app/features/inspector/types';

import { getDashboardSceneFor } from '../utils/utils';

import { HelpWizard } from './HelpWizard/HelpWizard';
import { InspectDataTab } from './InspectDataTab';
import { InspectErrorsAndNoticesTab } from './InspectErrorsAndNoticesTab';
import { InspectJsonTab } from './InspectJsonTab';
import { InspectMetaDataTab } from './InspectMetaDataTab';
import { InspectQueryTab } from './InspectQueryTab';
import { InspectStatsTab } from './InspectStatsTab';
import { type SceneInspectTab } from './types';

interface PanelInspectDrawerState extends SceneObjectState {
  tabs?: SceneInspectTab[];
  currentTab: InspectTab;
  panelRef: SceneObjectRef<VizPanel>;
  pluginNotLoaded?: boolean;
  canEdit?: boolean;
}

export class PanelInspectDrawer extends SceneObjectBase<PanelInspectDrawerState> {
  static Component = PanelInspectRenderer;
  private queryTabs?: SceneInspectTab[];
  private jsonTab?: InspectJsonTab;
  private metadataTab?: InspectMetaDataTab;
  private noticesTab?: InspectErrorsAndNoticesTab;

  constructor(state: PanelInspectDrawerState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const panel = this.state.panelRef.resolve();
    const context = panel.getPanelContext();
    const deactivateNotices = context.activateNotices?.();
    let discoveryVersion = 0;
    let provider = sceneGraph.getData(panel);
    const reconcile = () => this.reconcileTabs();
    const discoverInspectors = async () => {
      const version = ++discoveryVersion;
      const data = provider.state.data;
      const [metadataDataSource, noticesDataSource] = await Promise.all([
        getDataSourceWithInspector(data).catch(() => undefined),
        hasErrorsOrNotices(data) ? getDataSourceWithErrorsAndNoticesInspector(data).catch(() => undefined) : undefined,
      ]);
      // A newer result, provider replacement, or drawer close invalidates this discovery.
      if (version !== discoveryVersion) {
        return;
      }
      this.updateMetadataTab(metadataDataSource, data);
      // Preserve the visible tab while a loading refresh temporarily clears query notices.
      if (
        !this.noticesTab ||
        (this.noticesTab.state.dataSource !== noticesDataSource &&
          (noticesDataSource || data?.state !== LoadingState.Loading))
      ) {
        this.noticesTab = new InspectErrorsAndNoticesTab({
          panelRef: this.state.panelRef,
          dataSource: noticesDataSource,
        });
      }
      reconcile();
    };
    const updateData = () => {
      reconcile();
      void discoverInspectors();
    };
    const subscribeToData = () =>
      provider.subscribeToState((state, previous) => {
        if (state.data !== previous.data) {
          updateData();
        }
      });
    let dataSubscription = subscribeToData();
    const unsubscribeNotices = context.notices?.subscribe(reconcile);
    const pluginPolling = this.createPluginPolling(panel);
    const panelSubscription = panel.subscribeToState((state, previous) => {
      if (state.$data !== previous.$data) {
        dataSubscription.unsubscribe();
        provider = sceneGraph.getData(panel);
        dataSubscription = subscribeToData();
        updateData();
      }
      if (state.pluginId !== previous.pluginId) {
        pluginPolling.check();
      } else if (state._pluginLoadError !== previous._pluginLoadError) {
        reconcile();
      }
    });
    pluginPolling.check();
    void discoverInspectors();
    return () => {
      discoveryVersion++;
      pluginPolling.stop();
      unsubscribeNotices?.();
      dataSubscription.unsubscribe();
      panelSubscription.unsubscribe();
      deactivateNotices?.();
    };
  }

  private createPluginPolling(panel: VizPanel) {
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    // Plugin availability has no awaitable API; notice updates must not restart this timeout.
    const check = (elapsed = 0) => {
      clearTimeout(retryTimer);
      this.setState({ pluginNotLoaded: !panel.getPlugin() && elapsed >= 2000 });
      this.reconcileTabs();
      if (!panel.getPlugin() && elapsed < 2000) {
        retryTimer = setTimeout(() => check(elapsed + 100), 100);
      }
    };

    return { check, stop: () => clearTimeout(retryTimer) };
  }

  private updateMetadataTab(dataSource: DataSourceApi | undefined, data: PanelData | undefined) {
    if (this.metadataTab?.state.dataSource === dataSource) {
      return;
    }

    if (dataSource) {
      this.metadataTab = new InspectMetaDataTab({ panelRef: this.state.panelRef, dataSource });
      return;
    }

    // A refresh can temporarily clear results. Keep the existing tab until results settle.
    if (data?.state !== LoadingState.Loading) {
      this.metadataTab = undefined;
    }
  }

  private hasNotices(panel: VizPanel, panelData: PanelData | undefined) {
    const snapshot = panel.getPanelContext().notices?.getSnapshot();
    // An initialized host snapshot is authoritative, including an empty result.
    if (snapshot?.hostInitialized) {
      return snapshot.items.length > 0;
    }

    return hasErrorsOrNotices(panelData) || Boolean(panel.state._pluginLoadError) || Boolean(snapshot?.items.length);
  }

  private reconcileTabs() {
    const { panelRef } = this.state;
    const panel = panelRef.resolve();
    const tabs: SceneInspectTab[] = [];
    if (supportsDataQuery(panel.getPlugin())) {
      this.queryTabs ??= [
        new InspectDataTab({ panelRef }),
        new InspectStatsTab({ panelRef }),
        new InspectQueryTab({ panelRef }),
      ];
      tabs.push(...this.queryTabs);
      if (this.metadataTab) {
        tabs.push(this.metadataTab);
      }
    }
    const panelData = sceneGraph.getData(panel).state.data;
    // Avoid removing the visible notices tab while a refresh temporarily clears errors.
    const retainNoticesWhileLoading =
      panelData?.state === LoadingState.Loading &&
      Boolean(this.noticesTab && this.state.tabs?.includes(this.noticesTab));
    if (this.hasNotices(panel, panelData) || retainNoticesWhileLoading) {
      this.noticesTab ??= new InspectErrorsAndNoticesTab({ panelRef });
      tabs.push(this.noticesTab);
    }
    this.jsonTab ??= new InspectJsonTab({ panelRef, onClose: this.onClose });
    tabs.push(this.jsonTab);
    this.publishTabs(tabs);
  }

  private publishTabs(tabs: SceneInspectTab[]) {
    const { tabs: previousTabs, currentTab } = this.state;
    const tabsUnchanged =
      tabs.length === previousTabs?.length && tabs.every((tab, index) => tab === previousTabs[index]);
    if (tabsUnchanged) {
      return;
    }

    const selectedTabWasVisible = previousTabs?.some((tab) => tab.getTabValue() === currentTab);
    const selectedTabIsVisible = tabs.some((tab) => tab.getTabValue() === currentTab);
    if (selectedTabWasVisible && !selectedTabIsVisible) {
      this.setState({ tabs, currentTab: tabs[0].getTabValue() });
      return;
    }

    // Preserve an initial requested tab while datasource discovery may still make it available.
    this.setState({ tabs });
  }

  getDrawerTitle() {
    const panel = this.state.panelRef?.resolve();
    if (panel) {
      return sceneGraph.interpolate(panel, `Inspect: ${panel.state.title}`);
    }
    return `Inspect panel`;
  }

  onClose = () => {
    getDashboardSceneFor(this).closeModal();
  };
}

function PanelInspectRenderer({ model }: SceneComponentProps<PanelInspectDrawer>) {
  const { tabs, pluginNotLoaded, panelRef, currentTab } = model.useState();

  if (!tabs) {
    return null;
  }

  const vizPanel = panelRef!.resolve();
  const activeTab = tabs.find((tab) => tab.getTabValue() === currentTab) ?? tabs[0];

  if (currentTab === InspectTab.Help) {
    return <HelpWizard panel={vizPanel} onClose={model.onClose} />;
  }

  return (
    <Drawer
      title={model.getDrawerTitle()}
      onClose={model.onClose}
      size="md"
      tabs={
        <TabsBar>
          {tabs.map((tab) => {
            return (
              <Tab
                key={tab.state.key!}
                label={tab.getTabLabel()}
                active={tab === activeTab}
                onChangeTab={() => {
                  model.setState({ currentTab: tab.getTabValue() });
                }}
              />
            );
          })}
        </TabsBar>
      }
    >
      {pluginNotLoaded && (
        <Alert
          title={t('dashboard-scene.panel-inspect-renderer.title-panel-plugin-not-loaded', 'Panel plugin not loaded')}
        >
          <Trans i18nKey="dashboard-scene.panel-inspect-renderer.body-panel-plugin-not-loaded">
            Make sure the panel you want to inspect is visible and has been displayed before opening inspect.
          </Trans>
        </Alert>
      )}
      {activeTab.Component && <activeTab.Component model={activeTab} />}
    </Drawer>
  );
}
