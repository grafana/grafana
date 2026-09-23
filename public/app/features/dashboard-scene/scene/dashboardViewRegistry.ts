import { type VizPanel } from '@grafana/scenes';

import { type PanelInspectDrawer } from '../inspect/PanelInspectDrawer';
import { type ShareDrawerState } from '../sharing/ShareDrawer/ShareDrawer';

import { type DashboardScene } from './DashboardScene';
import { type DashboardSceneState, type DashboardViewState } from './types/dashboard';

type ViewRequest<K extends keyof DashboardViewState> = {
  key: K;
  load: () => Promise<DashboardViewState[K]>;
};

export type DashboardViewRequest = {
  [K in keyof DashboardViewState]-?: ViewRequest<K>;
}[keyof DashboardViewState];

type ViewLoader<K extends keyof DashboardViewState> = (...args: never[]) => ViewRequest<K>;

function loader<K extends keyof DashboardViewState, Args extends unknown[]>(
  key: K,
  load: (...args: Args) => Promise<DashboardViewState[K]>
) {
  return (...args: Args): ViewRequest<K> => ({ key, load: () => load(...args) });
}

// Every field that replaces or dismisses a pending view belongs in DashboardViewState and here.
// Register lazy loaders here too, so their target and result types share the cancellation contract.
// Ordinary data edits and loading bookkeeping must not cancel requests. Subscriptions cannot see
// intent before state changes: new requests and explicit close actions must also cancel old work.
export const dashboardViews = {
  body: true,
  isEditing: true,
  inspectPanelKey: true,
  viewPanel: true,
  editview: true,
  shareView: true,
  editPanel: loader('editPanel', async (panel: VizPanel, isNewPanel = false) => {
    const { buildPanelEditScene } = await import(/* webpackChunkName: "panel-edit" */ '../panel-edit/PanelEditor');
    return buildPanelEditScene(panel, isNewPanel);
  }),
  overlay: {
    save: loader(
      'overlay',
      async (
        dashboard: DashboardScene,
        options: Parameters<DashboardScene['openSaveDrawer']>[0],
        getShowVariablesWarning: () => boolean
      ) => {
        const { SaveDashboardDrawer } = await import(
          /* webpackChunkName: "save-dashboard-drawer" */ '../saving/SaveDashboardDrawer'
        );
        if (!dashboard.state.isEditing) {
          return;
        }
        return new SaveDashboardDrawer({
          ...options,
          dashboardRef: dashboard.getRef(),
          showVariablesWarning: getShowVariablesWarning(),
        });
      }
    ),
    share: loader('overlay', async (options: Omit<ShareDrawerState, 'activeShare'>) => {
      const { ShareDrawer } = await import(/* webpackChunkName: "share-drawer" */ '../sharing/ShareDrawer/ShareDrawer');
      return new ShareDrawer(options);
    }),
    filters: loader('overlay', async () => {
      const { DashboardFiltersOverviewDrawer } = await import(
        /* webpackChunkName: "dashboard-filters-overview" */ './dashboard-filters-overview/DashboardFiltersOverviewDrawer'
      );
      return new DashboardFiltersOverviewDrawer({});
    }),
    inspect: loader('overlay', async (panel: VizPanel, tab: PanelInspectDrawer['state']['currentTab']) => {
      const { PanelInspectDrawer } = await import(
        /* webpackChunkName: "panel-inspect" */ '../inspect/PanelInspectDrawer'
      );
      return new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: tab });
    }),
  },
} satisfies {
  [K in keyof DashboardViewState]-?: true | ViewLoader<K> | Record<string, ViewLoader<K>>;
};

export function dashboardViewChanged(state: DashboardSceneState, previous: DashboardSceneState) {
  // Object.keys loses the keys of this closed, compiler-checked registry.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return (Object.keys(dashboardViews) as Array<keyof DashboardViewState>).some((key) => state[key] !== previous[key]);
}
