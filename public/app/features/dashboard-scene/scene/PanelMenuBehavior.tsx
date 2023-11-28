import { InterpolateFunction, PanelMenuItem } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { VizPanel, VizPanelMenu, sceneGraph } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { PanelModel } from 'app/features/dashboard/state';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { addDataTrailPanelAction } from 'app/features/trails/dashboardIntegration';

import { ShareModal } from '../sharing/ShareModal';
import { getDashboardUrl, getInspectUrl, getViewPanelUrl, tryGetExploreUrlForPanel } from '../utils/urlBuilders';
import { getPanelIdForVizPanel } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { LibraryVizPanel } from './LibraryVizPanel';
import { VizPanelLinks } from './PanelLinks';

/**
 * Behavior is called when VizPanelMenu is activated (ie when it's opened).
 */
export function panelMenuBehavior(menu: VizPanelMenu) {
  const asyncFunc = async () => {
    // hm.. add another generic param to SceneObject to specify parent type?
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const panel = menu.parent as VizPanel;
    const plugin = panel.getPlugin();

    const location = locationService.getLocation();
    const items: PanelMenuItem[] = [];
    const moreSubMenu: PanelMenuItem[] = [];
    const inspectSubMenu: PanelMenuItem[] = [];
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

      if (dashboard.canEditDashboard()) {
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
            useExperimentalURL: true,
          }),
        });
      }

      items.push({
        text: t('panel.header-menu.share', `Share`),
        iconClassName: 'share-alt',
        onClick: () => {
          reportInteraction('dashboards_panelheader_menu', { item: 'share' });
          dashboard.showModal(new ShareModal({ panelRef: panel.getRef(), dashboardRef: dashboard.getRef() }));
        },
        shortcut: 'p s',
      });

      if (panel.parent instanceof LibraryVizPanel) {
        // TODO: Implement lib panel unlinking
      } else {
        moreSubMenu.push({
          text: t('panel.header-menu.create-library-panel', `Create library panel`),
          iconClassName: 'share-alt',
          onClick: () => {
            reportInteraction('dashboards_panelheader_menu', { item: 'createLibraryPanel' });
            dashboard.showModal(
              new ShareModal({
                panelRef: panel.getRef(),
                dashboardRef: dashboard.getRef(),
                activeTab: 'Library panel',
              })
            );
          },
        });
      }

      if (config.featureToggles.datatrails) {
        addDataTrailPanelAction(dashboard, panel, items);
      }
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

    if (plugin && !plugin.meta.skipDataQuery) {
      inspectSubMenu.push({
        text: t('panel.header-menu.inspect-data', `Data`),
        href: getInspectUrl(panel, InspectTab.Data),
        onClick: (e) => {
          e.preventDefault();
          locationService.partial({ inspect: panel.state.key, inspectTab: InspectTab.Data });
          reportInteraction('dashboards_panelheader_menu', { item: 'inspect', tab: InspectTab.Data });
        },
      });

      if (dashboard instanceof DashboardScene && dashboard.state.meta.canEdit) {
        inspectSubMenu.push({
          text: t('panel.header-menu.query', `Query`),
          href: getInspectUrl(panel, InspectTab.Query),
          onClick: (e) => {
            e.preventDefault();
            locationService.partial({ inspect: panel.state.key, inspectTab: InspectTab.Query });
            reportInteraction('dashboards_panelheader_menu', { item: 'inspect', tab: InspectTab.Query });
          },
        });
      }
    }

    inspectSubMenu.push({
      text: t('panel.header-menu.inspect-json', `Panel JSON`),
      href: getInspectUrl(panel, InspectTab.JSON),
      onClick: (e) => {
        e.preventDefault();
        locationService.partial({ inspect: panel.state.key, inspectTab: InspectTab.JSON });
        reportInteraction('dashboards_panelheader_menu', { item: 'inspect', tab: InspectTab.JSON });
      },
    });

    items.push({
      text: t('panel.header-menu.inspect', `Inspect`),
      iconClassName: 'info-circle',
      shortcut: 'i',
      href: getInspectUrl(panel),
      onClick: (e) => {
        if (!e.isDefaultPrevented()) {
          locationService.partial({ inspect: panel.state.key, inspectTab: InspectTab.Data });
          reportInteraction('dashboards_panelheader_menu', { item: 'inspect', tab: InspectTab.Data });
        }
      },
      subMenu: inspectSubMenu.length > 0 ? inspectSubMenu : undefined,
    });

    if (moreSubMenu.length) {
      items.push({
        type: 'submenu',
        text: t('panel.header-menu.more', `More...`),
        iconClassName: 'cube',
        subMenu: moreSubMenu,
        onClick: (e) => {
          e.preventDefault();
        },
      });
    }

    menu.setState({ items });
  };

  asyncFunc();
}

/**
 * Behavior is called when VizPanelLinksMenu is activated (when it's opened).
 */
export function getPanelLinksBehavior(panel: PanelModel) {
  return (panelLinksMenu: VizPanelLinks) => {
    const interpolate: InterpolateFunction = (v, scopedVars) => {
      return sceneGraph.interpolate(panelLinksMenu, v, scopedVars);
    };

    const linkSupplier = getPanelLinksSupplier(panel, interpolate);

    if (!linkSupplier) {
      return;
    }

    const panelLinks = linkSupplier && linkSupplier.getLinks(interpolate);

    const links = panelLinks.map((panelLink) => ({
      ...panelLink,
      onClick: (e: any, origin: any) => {
        reportInteraction('dashboards_panelheader_datalink_clicked', { has_multiple_links: panelLinks.length > 1 });
        panelLink.onClick?.(e, origin);
      },
    }));
    panelLinksMenu.setState({ links });
  };
}
