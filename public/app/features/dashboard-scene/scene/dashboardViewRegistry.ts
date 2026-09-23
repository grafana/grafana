import { type VizPanel } from '@grafana/scenes';

import { type PanelInspectDrawer } from '../inspect/PanelInspectDrawer';
import { type ShareDrawerState } from '../sharing/ShareDrawer/ShareDrawer';

import { type DashboardScene } from './DashboardScene';
import { type DashboardSceneState, type DashboardViewState } from './types/dashboard';

// Every field that replaces or dismisses a pending view belongs in DashboardViewState and here.
// Ordinary data edits and loading bookkeeping must not cancel requests. Subscriptions cannot see
// intent before state changes: new requests and explicit close actions must also cancel old work.
const viewStateKeys = {
  body: true,
  isEditing: true,
  inspectPanelKey: true,
  viewPanel: true,
  editview: true,
  shareView: true,
  editPanel: true,
  overlay: true,
} satisfies Record<keyof DashboardViewState, true>;

type ViewStateKey = keyof typeof viewStateKeys;

// Object.keys loses the keys of this closed, compiler-checked registry.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const viewStateKeyList = Object.keys(viewStateKeys) as ViewStateKey[];

type ViewRequest<K extends ViewStateKey> = {
  key: K;
  load: () => Promise<DashboardViewState[K]>;
};

export type DashboardViewRequest = {
  [K in ViewStateKey]: ViewRequest<K>;
}[ViewStateKey];

function loader<K extends ViewStateKey, Args extends unknown[]>(
  key: K,
  load: (...args: Args) => Promise<DashboardViewState[K]>
) {
  return (...args: Args): ViewRequest<K> => ({ key, load: () => load(...args) });
}

// The helper ties each loader's result to a state key observed by cancellation.
export const dashboardViews = {
  editPanel: loader('editPanel', async (panel: VizPanel, isNewPanel?: boolean) => {
    const { buildPanelEditScene } = await import(/* webpackChunkName: "panel-edit" */ '../panel-edit/PanelEditor');
    return buildPanelEditScene(panel, isNewPanel ?? false);
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
};

export function dashboardViewChanged(state: DashboardSceneState, previous: DashboardSceneState) {
  return viewStateKeyList.some((key) => state[key] !== previous[key]);
}
