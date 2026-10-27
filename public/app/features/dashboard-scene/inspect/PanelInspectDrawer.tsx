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

  constructor(state: PanelInspectDrawerState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const deactivateNotices = this.state.panelRef.resolve().getPanelContext().activateNotices?.();
    this.buildTabs(0);
    return deactivateNotices;
  }

  /**
   * We currently have no async await to get the panel plugin from the VizPanel.
   * That is why there is a retry argument here and a setTimeout, to try again a bit later.
   */
  async buildTabs(retry: number) {
    const panelRef = this.state.panelRef;
    const plugin = panelRef.resolve()?.getPlugin();
    const tabs: SceneInspectTab[] = [];

    if (!plugin) {
      if (retry < 2000) {
        setTimeout(() => this.buildTabs(retry + 100), 100);
      } else {
        this.setState({ pluginNotLoaded: true });
      }
    }

    if (panelRef) {
      const panel = panelRef.resolve();
      const data = sceneGraph.getData(panel);
      if (supportsDataQuery(plugin)) {
        tabs.push(new InspectDataTab({ panelRef }));
        tabs.push(new InspectStatsTab({ panelRef }));
        tabs.push(new InspectQueryTab({ panelRef }));

        const dsWithInspector = await getDataSourceWithInspector(data.state.data);
        if (dsWithInspector) {
          tabs.push(new InspectMetaDataTab({ panelRef, dataSource: dsWithInspector }));
        }
      }

      const snapshot = panel.getPanelContext().notices?.getSnapshot();
      const hasNotices = snapshot?.hostInitialized
        ? snapshot.items.length > 0
        : hasErrorsOrNotices(data.state.data) ||
          Boolean(panel.state._pluginLoadError) ||
          Boolean(snapshot?.items.length);
      if (hasNotices) {
        const dsWithErrorsAndNotices = hasErrorsOrNotices(data.state.data)
          ? await getDataSourceWithErrorsAndNoticesInspector(data.state.data)
          : undefined;
        tabs.push(new InspectErrorsAndNoticesTab({ panelRef, dataSource: dsWithErrorsAndNotices }));
      }

      tabs.push(new InspectJsonTab({ panelRef, onClose: this.onClose }));
    }

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
