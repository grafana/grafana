import {
  InterpolateFunction,
  PanelMenuItem,
  PanelPlugin,
  PluginExtensionPanelContext,
  PluginExtensionPoints,
  getTimeZone,
  urlUtil,
} from '@grafana/data';
import { config, getPluginLinkExtensions, locationService } from '@grafana/runtime';
import { LocalValueVariable, SceneGridRow, VizPanel, VizPanelMenu, sceneGraph } from '@grafana/scenes';
import { DataQuery, OptionsWithLegend } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { scenesPanelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { InspectTab } from 'app/features/inspector/types';
import { getScenePanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { createExtensionSubMenu } from 'app/features/plugins/extensions/utils';
import { addDataTrailPanelAction } from 'app/features/trails/Integrations/dashboardIntegration';
import { ShowConfirmModalEvent } from 'app/types/events';

import { ShareModal } from '../sharing/ShareModal';
import { DashboardInteractions } from '../utils/interactions';
import { getEditPanelUrl, getInspectUrl, getViewPanelUrl, tryGetExploreUrlForPanel } from '../utils/urlBuilders';
import { getDashboardSceneFor, getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { LibraryVizPanel } from './LibraryVizPanel';
import { VizPanelLinks, VizPanelLinksMenu } from './PanelLinks';
import { UnlinkLibraryPanelModal } from './UnlinkLibraryPanelModal';

/**
 * Behavior is called when VizPanelMenu is activated (ie when it's opened).
 */
export function panelMenuBehavior(menu: VizPanelMenu, isRepeat = false) {
  const asyncFunc = async () => {
    // hm.. add another generic param to SceneObject to specify parent type?
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const panel = menu.parent as VizPanel;
    const parent = panel.parent;
    const plugin = panel.getPlugin();

    const items: PanelMenuItem[] = [];
    const moreSubMenu: PanelMenuItem[] = [];
    const dashboard = getDashboardSceneFor(panel);
    const { isEmbedded } = dashboard.state.meta;
    const exploreMenuItem = await getExploreMenuItem(panel);

    // For embedded dashboards we only have explore action for now
    if (isEmbedded) {
      if (exploreMenuItem) {
        menu.setState({ items: [exploreMenuItem] });
      }
      return;
    }

    const isEditingPanel = Boolean(dashboard.state.editPanel);
    if (!isEditingPanel) {
      items.push({
        text: t('panel.header-menu.view', `View`),
        iconClassName: 'eye',
        shortcut: 'v',
        onClick: () => DashboardInteractions.panelMenuItemClicked('view'),
        href: getViewPanelUrl(panel),
      });
    }

    if (dashboard.canEditDashboard() && !isRepeat && !isEditingPanel) {
      // We could check isEditing here but I kind of think this should always be in the menu,
      // and going into panel edit should make the dashboard go into edit mode is it's not already
      items.push({
        text: t('panel.header-menu.edit', `Edit`),
        iconClassName: 'eye',
        shortcut: 'e',
        onClick: () => DashboardInteractions.panelMenuItemClicked('edit'),
        href: getEditPanelUrl(getPanelIdForVizPanel(panel)),
      });
    }

    items.push({
      text: t('panel.header-menu.share', `Share`),
      iconClassName: 'share-alt',
      onClick: () => {
        DashboardInteractions.panelMenuItemClicked('share');
        dashboard.showModal(new ShareModal({ panelRef: panel.getRef(), dashboardRef: dashboard.getRef() }));
      },
      shortcut: 'p s',
    });

    if (dashboard.state.isEditing && !isRepeat && !isEditingPanel) {
      moreSubMenu.push({
        text: t('panel.header-menu.duplicate', `Duplicate`),
        onClick: () => {
          DashboardInteractions.panelMenuItemClicked('duplicate');
          dashboard.duplicatePanel(panel);
        },
        shortcut: 'p d',
      });
    }

    if (!isEditingPanel) {
      moreSubMenu.push({
        text: t('panel.header-menu.copy', `Copy`),
        onClick: () => {
          DashboardInteractions.panelMenuItemClicked('copy');
          dashboard.copyPanel(panel);
        },
      });
    }

    if (dashboard.state.isEditing && !isRepeat && !isEditingPanel) {
      if (parent instanceof LibraryVizPanel) {
        moreSubMenu.push({
          text: t('panel.header-menu.unlink-library-panel', `Unlink library panel`),
          onClick: () => {
            DashboardInteractions.panelMenuItemClicked('unlinkLibraryPanel');
            dashboard.showModal(
              new UnlinkLibraryPanelModal({
                panelRef: parent.getRef(),
              })
            );
          },
        });
      } else {
        moreSubMenu.push({
          text: t('panel.header-menu.create-library-panel', `Create library panel`),
          onClick: () => {
            DashboardInteractions.panelMenuItemClicked('createLibraryPanel');
            dashboard.showModal(
              new ShareModal({
                panelRef: panel.getRef(),
                dashboardRef: dashboard.getRef(),
                activeTab: shareDashboardType.libraryPanel,
              })
            );
          },
        });
      }
    }

    moreSubMenu.push({
      text: t('panel.header-menu.new-alert-rule', `New alert rule`),
      onClick: (e) => onCreateAlert(panel),
    });

    if (hasLegendOptions(panel.state.options) && !isEditingPanel) {
      moreSubMenu.push({
        text: panel.state.options.legend.showLegend
          ? t('panel.header-menu.hide-legend', 'Hide legend')
          : t('panel.header-menu.show-legend', 'Show legend'),
        onClick: (e) => {
          e.preventDefault();
          toggleVizPanelLegend(panel);
        },
        shortcut: 'p l',
      });
    }

    if (dashboard.canEditDashboard() && plugin && !plugin.meta.skipDataQuery && !isRepeat) {
      moreSubMenu.push({
        text: t('panel.header-menu.get-help', 'Get help'),
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          onInspectPanel(panel, InspectTab.Help);
        },
      });
    }

    if (config.featureToggles.exploreMetrics) {
      addDataTrailPanelAction(dashboard, panel, items);
    }

    if (exploreMenuItem) {
      items.push(exploreMenuItem);
    }

    items.push(getInspectMenuItem(plugin, panel, dashboard));

    const { extensions } = getPluginLinkExtensions({
      extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
      context: createExtensionContext(panel, dashboard),
      limitPerPlugin: 3,
    });

    if (extensions.length > 0 && !dashboard.state.isEditing) {
      items.push({
        text: 'Extensions',
        iconClassName: 'plug',
        type: 'submenu',
        subMenu: createExtensionSubMenu(extensions),
      });
    }

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

    if (dashboard.state.isEditing && !isRepeat && !isEditingPanel) {
      items.push({
        text: '',
        type: 'divider',
      });

      items.push({
        text: t('panel.header-menu.remove', `Remove`),
        iconClassName: 'trash-alt',
        onClick: () => {
          DashboardInteractions.panelMenuItemClicked('remove');
          onRemovePanel(dashboard, panel);
        },
        shortcut: 'p r',
      });
    }

    menu.setState({ items });
  };

  asyncFunc();
}

export const repeatPanelMenuBehavior = (menu: VizPanelMenu) => panelMenuBehavior(menu, true);

async function getExploreMenuItem(panel: VizPanel): Promise<PanelMenuItem | undefined> {
  const exploreUrl = await tryGetExploreUrlForPanel(panel);
  if (!exploreUrl) {
    return undefined;
  }

  return {
    text: t('panel.header-menu.explore', `Explore`),
    iconClassName: 'compass',
    shortcut: 'p x',
    onClick: () => DashboardInteractions.panelMenuItemClicked('explore'),
    href: exploreUrl,
  };
}

function getInspectMenuItem(
  plugin: PanelPlugin | undefined,
  panel: VizPanel,
  dashboard: DashboardScene
): PanelMenuItem {
  const inspectSubMenu: PanelMenuItem[] = [];

  if (plugin && !plugin.meta.skipDataQuery) {
    inspectSubMenu.push({
      text: t('panel.header-menu.inspect-data', `Data`),
      href: getInspectUrl(panel, InspectTab.Data),
      onClick: (e) => {
        e.preventDefault();
        locationService.partial({ inspect: panel.state.key, inspectTab: InspectTab.Data });
        DashboardInteractions.panelMenuInspectClicked(InspectTab.Data);
      },
    });

    if (dashboard instanceof DashboardScene && dashboard.state.meta.canEdit) {
      inspectSubMenu.push({
        text: t('panel.header-menu.query', `Query`),
        href: getInspectUrl(panel, InspectTab.Query),
        onClick: (e) => {
          e.preventDefault();
          locationService.partial({ inspect: panel.state.key, inspectTab: InspectTab.Query });
          DashboardInteractions.panelMenuInspectClicked(InspectTab.Query);
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
      DashboardInteractions.panelMenuInspectClicked(InspectTab.JSON);
    },
  });

  return {
    text: t('panel.header-menu.inspect', `Inspect`),
    iconClassName: 'info-circle',
    shortcut: 'i',
    href: getInspectUrl(panel),
    onClick: (e) => {
      if (!e.isDefaultPrevented()) {
        locationService.partial({ inspect: panel.state.key, inspectTab: InspectTab.Data });
        DashboardInteractions.panelMenuInspectClicked(InspectTab.Data);
      }
    },
    subMenu: inspectSubMenu.length > 0 ? inspectSubMenu : undefined,
  };
}

/**
 * Behavior is called when VizPanelLinksMenu is activated (when it's opened).
 */
export function panelLinksBehavior(panelLinksMenu: VizPanelLinksMenu) {
  if (!(panelLinksMenu.parent instanceof VizPanelLinks)) {
    throw new Error('parent of VizPanelLinksMenu must be VizPanelLinks');
  }
  const panel = panelLinksMenu.parent.parent;

  if (!(panel instanceof VizPanel)) {
    throw new Error('parent of VizPanelLinks must be VizPanel');
  }

  panelLinksMenu.setState({ links: getPanelLinks(panel) });
}

export function getPanelLinks(panel: VizPanel) {
  const interpolate: InterpolateFunction = (v, scopedVars) => {
    return sceneGraph.interpolate(panel, v, scopedVars);
  };

  const linkSupplier = getScenePanelLinksSupplier(panel, interpolate);

  if (!linkSupplier) {
    return [];
  }

  const panelLinks = linkSupplier.getLinks(interpolate);

  return panelLinks.map((panelLink) => ({
    ...panelLink,
    onClick: (e: any, origin: any) => {
      DashboardInteractions.panelLinkClicked({ has_multiple_links: panelLinks.length > 1 });
      panelLink.onClick?.(e, origin);
    },
  }));
}

function createExtensionContext(panel: VizPanel, dashboard: DashboardScene): PluginExtensionPanelContext {
  const timeRange = sceneGraph.getTimeRange(panel);
  let queryRunner = getQueryRunnerFor(panel);
  const targets: DataQuery[] = queryRunner?.state.queries as DataQuery[];
  const id = getPanelIdForVizPanel(panel);

  let scopedVars = {};

  // Handle panel repeats scenario
  if (panel.state.$variables) {
    panel.state.$variables.state.variables.forEach((variable) => {
      if (variable instanceof LocalValueVariable) {
        scopedVars = {
          ...scopedVars,
          [variable.state.name]: { value: variable.getValue(), text: variable.getValueText() },
        };
      }
    });
  }

  // Handle row repeats scenario
  if (panel.parent?.parent instanceof SceneGridRow) {
    const row = panel.parent.parent;
    if (row.state.$variables) {
      row.state.$variables.state.variables.forEach((variable) => {
        if (variable instanceof LocalValueVariable) {
          scopedVars = {
            ...scopedVars,
            [variable.state.name]: { value: variable.getValue(), text: variable.getValueText() },
          };
        }
      });
    }
  }

  return {
    id,
    pluginId: panel.state.pluginId,
    title: panel.state.title,
    timeRange: timeRange.state.value.raw,
    timeZone: getTimeZone({
      timeZone: timeRange.getTimeZone(),
    }),
    dashboard: {
      uid: dashboard.state.uid!,
      title: dashboard.state.title,
      tags: dashboard.state.tags || [],
    },
    targets,
    scopedVars,
    data: queryRunner?.state.data,
  };
}

export function onRemovePanel(dashboard: DashboardScene, panel: VizPanel) {
  appEvents.publish(
    new ShowConfirmModalEvent({
      title: 'Remove panel',
      text: 'Are you sure you want to remove this panel?',
      icon: 'trash-alt',
      yesText: 'Remove',
      onConfirm: () => dashboard.removePanel(panel),
    })
  );
}

const onCreateAlert = async (panel: VizPanel) => {
  DashboardInteractions.panelMenuItemClicked('create-alert');

  const formValues = await scenesPanelToRuleFormValues(panel);
  const ruleFormUrl = urlUtil.renderUrl('/alerting/new', {
    defaults: JSON.stringify(formValues),
    returnTo: location.pathname + location.search,
  });

  locationService.push(ruleFormUrl);

  DashboardInteractions.panelMenuItemClicked('create-alert');
};

export function toggleVizPanelLegend(vizPanel: VizPanel): void {
  const options = vizPanel.state.options;
  if (hasLegendOptions(options) && typeof options.legend.showLegend === 'boolean') {
    vizPanel.onOptionsChange({
      legend: {
        showLegend: options.legend.showLegend ? false : true,
      },
    });
  }

  DashboardInteractions.panelMenuItemClicked('toggleLegend');
}

function hasLegendOptions(optionsWithLegend: unknown): optionsWithLegend is OptionsWithLegend {
  return optionsWithLegend != null && typeof optionsWithLegend === 'object' && 'legend' in optionsWithLegend;
}

const onInspectPanel = (vizPanel: VizPanel, tab?: InspectTab) => {
  locationService.partial({
    inspect: vizPanel.state.key,
    inspectTab: tab,
  });
  DashboardInteractions.panelMenuInspectClicked(tab ?? InspectTab.Data);
};
