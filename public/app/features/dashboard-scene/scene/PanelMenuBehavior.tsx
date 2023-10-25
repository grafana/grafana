import { PanelMenuItem } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { VizPanel, VizPanelMenu } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { InspectTab } from 'app/features/inspector/types';

import { ShareModal } from '../sharing/ShareModal';
import { getDashboardUrl, getInspectUrl, getViewPanelUrl, tryGetExploreUrlForPanel } from '../utils/urlBuilders';
import { getPanelIdForVizPanel } from '../utils/utils';

import { DashboardScene } from './DashboardScene';

/**
 * Behavior is called when VizPanelMenu is activated (ie when it's opened).
 */
export function panelMenuBehavior(menu: VizPanelMenu) {
  const asyncFunc = async () => {
    // hm.. add another generic param to SceneObject to specify parent type?
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const panel = menu.parent as VizPanel;
    const location = locationService.getLocation();
    const items: PanelMenuItem[] = [];
    const panelId = getPanelIdForVizPanel(panel);
    const dashboard = panel.getRoot();

    if (dashboard instanceof DashboardScene) {
      items.push({
        text: t('panel.header-menu.view', `View`),
        iconClassName: 'eye',
        shortcut: 'v',
        onClick: () => reportInteraction('dashboards_panelheader_menu', { item: 'view' }),
        href: getViewPanelUrl(panel),
      });

      // We could check isEditing here but I kind of think this should always be in the menu,
      // and going into panel edit should make the dashboard go into edit mode is it's not already
      items.push({
        text: t('panel.header-menu.edit', `Edit`),
        iconClassName: 'eye',
        shortcut: 'e',
        onClick: () => reportInteraction('dashboards_panelheader_menu', { item: 'edit' }),
        href: getDashboardUrl({
          uid: dashboard.state.uid,
          subPath: `/panel-edit/${panelId}`,
          currentQueryParams: location.search,
        }),
      });

      items.push({
        text: t('panel.header-menu.share', `Share`),
        iconClassName: 'share-alt',
        onClick: () => {
          reportInteraction('dashboards_panelheader_menu', { item: 'share' });
          dashboard.showModal(new ShareModal({ panelRef: panel.getRef(), dashboardRef: dashboard.getRef() }));
        },
        shortcut: 'p s',
      });
    }

    const exploreUrl = await tryGetExploreUrlForPanel(panel);
    if (exploreUrl) {
      items.push({
        text: t('panel.header-menu.explore', `Explore`),
        iconClassName: 'compass',
        shortcut: 'p x',
        onClick: () => reportInteraction('dashboards_panelheader_menu', { item: 'explore' }),
        href: exploreUrl,
      });
    }

    items.push({
      text: t('panel.header-menu.inspect', `Inspect`),
      iconClassName: 'info-circle',
      shortcut: 'i',
      onClick: () => reportInteraction('dashboards_panelheader_menu', { item: 'inspect', tab: InspectTab.Data }),
      href: getInspectUrl(panel),
    });

    menu.setState({ items });
  };

  asyncFunc();
}
