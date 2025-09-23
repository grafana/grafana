import { useLocation } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  sceneGraph,
  VizPanel,
  SceneObjectRef,
} from '@grafana/scenes';
import { Alert, Drawer, Tab, TabsBar } from '@grafana/ui';
import { getDataSourceWithInspector } from 'app/features/dashboard/components/Inspector/hooks';
import { supportsDataQuery } from 'app/features/dashboard/components/PanelEditor/utils';
import { InspectTab } from 'app/features/inspector/types';

import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardUrl } from '../utils/getDashboardUrl';
import { getDashboardSceneFor } from '../utils/utils';

import { HelpWizard } from './HelpWizard/HelpWizard';
import { InspectDataTab } from './InspectDataTab';
import { InspectJsonTab } from './InspectJsonTab';
import { InspectMetaDataTab } from './InspectMetaDataTab';
import { InspectQueryTab } from './InspectQueryTab';
import { InspectStatsTab } from './InspectStatsTab';
import { SceneInspectTab } from './types';

interface PanelInspectDrawerState extends SceneObjectState {
  tabs?: SceneInspectTab[];
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
    this.buildTabs(0);
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
      if (supportsDataQuery(plugin)) {
        const data = sceneGraph.getData(panelRef.resolve());

        tabs.push(new InspectDataTab({ panelRef }));
        tabs.push(new InspectStatsTab({ panelRef }));
        tabs.push(new InspectQueryTab({ panelRef }));

        const dsWithInspector = await getDataSourceWithInspector(data.state.data);
        if (dsWithInspector) {
          tabs.push(new InspectMetaDataTab({ panelRef, dataSource: dsWithInspector }));
        }
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
    onPanelInspectClose(getDashboardSceneFor(this));
  };
}

function PanelInspectRenderer({ model }: SceneComponentProps<PanelInspectDrawer>) {
  const { tabs, pluginNotLoaded, panelRef } = model.useState();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  if (!tabs) {
    return null;
  }

  const urlTab = queryParams.get('inspectTab');
  const currentTab = tabs.find((tab) => tab.getTabValue() === urlTab) ?? tabs[0];

  const vizPanel = panelRef!.resolve();

  if (urlTab === InspectTab.Help) {
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
                active={tab === currentTab}
                href={locationUtil.getUrlForPartial(location, { inspectTab: tab.getTabValue() })}
              />
            );
          })}
        </TabsBar>
      }
    >
      {pluginNotLoaded && (
        <Alert title="Panel plugin not loaded">
          Make sure the panel you want to inspect is visible and has been displayed before opening inspect.
        </Alert>
      )}
      {currentTab && currentTab.Component && <currentTab.Component model={currentTab} />}
    </Drawer>
  );
}

export function onPanelInspectClose(dashboard: DashboardScene) {
  const meta = dashboard.state.meta;
  // Checking for location here as well, otherwise down below isHomeDashboard will be set to true
  // as it doesn't have uid neither slug nor url.
  const isNew = !dashboard.state.uid && locationService.getLocation().pathname === '/dashboard/new';

  locationService.push(
    getDashboardUrl({
      uid: dashboard.state.uid,
      slug: dashboard.state.meta.slug,
      currentQueryParams: locationService.getLocation().search,
      updateQuery: {
        inspect: null,
        inspectTab: null,
      },
      isHomeDashboard: !meta.url && !meta.slug && !isNew,
    })
  );
}
