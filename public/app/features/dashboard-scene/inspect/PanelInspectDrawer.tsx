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
    let provider = sceneGraph.getData(panel);
    let discoveryVersion = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const reconcile = () => this.reconcileTabs();
    const discoverInspectors = async () => {
      const version = ++discoveryVersion;
      const data = provider.state.data;
      const [metadata, notices] = await Promise.all([
        getDataSourceWithInspector(data).catch(() => undefined),
        getDataSourceWithErrorsAndNoticesInspector(data).catch(() => undefined),
      ]);
      if (version !== discoveryVersion) {
        return;
      }
      const { panelRef } = this.state;
      if (this.metadataTab?.state.dataSource !== metadata) {
        this.metadataTab = metadata ? new InspectMetaDataTab({ panelRef, dataSource: metadata }) : undefined;
      }
      if (this.noticesTab?.state.dataSource !== notices) {
        this.noticesTab = notices ? new InspectErrorsAndNoticesTab({ panelRef, dataSource: notices }) : undefined;
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
    // Plugin availability has no awaitable API; data updates must not restart this timeout.
    const checkPlugin = (elapsed = 0) => {
      clearTimeout(retryTimer);
      this.setState({ pluginNotLoaded: !panel.getPlugin() && elapsed >= 2000 });
      reconcile();
      if (!panel.getPlugin() && elapsed < 2000) {
        retryTimer = setTimeout(() => checkPlugin(elapsed + 100), 100);
      }
    };
    let dataSubscription = subscribeToData();
    const panelSubscription = panel.subscribeToState((state, previous) => {
      if (state.$data !== previous.$data) {
        dataSubscription.unsubscribe();
        provider = sceneGraph.getData(panel);
        dataSubscription = subscribeToData();
        updateData();
      }
      if (state.pluginId !== previous.pluginId) {
        checkPlugin();
      }
    });
    checkPlugin();
    void discoverInspectors();
    return () => {
      discoveryVersion++;
      clearTimeout(retryTimer);
      dataSubscription.unsubscribe();
      panelSubscription.unsubscribe();
    };
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
      if (hasErrorsOrNotices(sceneGraph.getData(panel).state.data)) {
        this.noticesTab ??= new InspectErrorsAndNoticesTab({ panelRef });
        tabs.push(this.noticesTab);
      }
    }
    this.jsonTab ??= new InspectJsonTab({ panelRef, onClose: this.onClose });
    tabs.push(this.jsonTab);
    if (tabs.length !== this.state.tabs?.length || tabs.some((tab, index) => tab !== this.state.tabs?.[index])) {
      this.setState({ tabs });
    }
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
