import { InterpolateFunction, PanelMenuItem } from '@grafana/data';
import { config, getDataSourceSrv, locationService, reportInteraction } from '@grafana/runtime';
import { VizPanel, VizPanelMenu, sceneGraph } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { PanelModel } from 'app/features/dashboard/state';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { DataTrailDrawer } from 'app/features/trails/DataTrailDrawer';
import { buildVisualQueryFromString } from 'app/plugins/datasource/prometheus/querybuilder/parsing';

import { ShareModal } from '../sharing/ShareModal';
import { getDashboardUrl, getInspectUrl, getViewPanelUrl, tryGetExploreUrlForPanel } from '../utils/urlBuilders';
import { getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { VizPanelLinks } from './PanelLinks';

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

      if (config.featureToggles.datatrails) {
        addDataTrailAction(dashboard, panel, items);
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

function addDataTrailAction(dashboard: DashboardScene, vizPanel: VizPanel, items: PanelMenuItem[]) {
  const queryRunner = getQueryRunnerFor(vizPanel);
  if (!queryRunner) {
    return;
  }

  const ds = getDataSourceSrv().getInstanceSettings(queryRunner.state.datasource);
  if (!ds || ds.meta.id !== 'prometheus' || queryRunner.state.queries.length > 1) {
    return;
  }

  const query = queryRunner.state.queries[0];
  const parsedResult = buildVisualQueryFromString(query.expr);
  if (parsedResult.errors.length > 0) {
    return;
  }

  items.push({
    text: 'Data trail',
    iconClassName: 'code-branch',
    onClick: () => {
      dashboard.showModal(
        new DataTrailDrawer({ query: parsedResult.query, dsRef: ds, timeRange: dashboard.state.$timeRange!.clone() })
      );
    },
    shortcut: 'p s',
  });
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
