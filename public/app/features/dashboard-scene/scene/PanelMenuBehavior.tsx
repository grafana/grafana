import {
  getTimeZone,
  InterpolateFunction,
  LinkModel,
  PanelMenuItem,
  PanelPlugin,
  PluginExtensionPanelContext,
  PluginExtensionPoints,
  urlUtil,
} from '@grafana/data';
import { config, getPluginLinkExtensions, locationService } from '@grafana/runtime';
import { LocalValueVariable, sceneGraph, SceneGridRow, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { DataQuery, OptionsWithLegend } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';
import { notifyApp } from 'app/core/reducers/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { getMessageFromError } from 'app/core/utils/errors';
import { getCreateAlertInMenuAvailability } from 'app/features/alerting/unified/utils/access-control';
import { scenesPanelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { InspectTab } from 'app/features/inspector/types';
import { getScenePanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { createExtensionSubMenu } from 'app/features/plugins/extensions/utils';
import { addDataTrailPanelAction } from 'app/features/trails/Integrations/dashboardIntegration';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { ShareDrawer } from '../sharing/ShareDrawer/ShareDrawer';
import { ShareModal } from '../sharing/ShareModal';
import { DashboardInteractions } from '../utils/interactions';
import { getEditPanelUrl, getInspectUrl, getViewPanelUrl, tryGetExploreUrlForPanel } from '../utils/urlBuilders';
import { getDashboardSceneFor, getPanelIdForVizPanel, getQueryRunnerFor, isLibraryPanel } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
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
        href: getViewPanelUrl(panel),
      });
    }

    if (dashboard.canEditDashboard() && dashboard.state.editable && !isRepeat && !isEditingPanel) {
      // We could check isEditing here but I kind of think this should always be in the menu,
      // and going into panel edit should make the dashboard go into edit mode is it's not already
      items.push({
        text: t('panel.header-menu.edit', `Edit`),
        iconClassName: 'edit',
        shortcut: 'e',
        href: getEditPanelUrl(getPanelIdForVizPanel(panel)),
      });
    }

    if (config.featureToggles.newDashboardSharingComponent) {
      const subMenu: PanelMenuItem[] = [];
      subMenu.push({
        text: t('share-panel.menu.share-link-title', 'Share link'),
        iconClassName: 'link',
        shortcut: 'p u',
        onClick: () => {
          DashboardInteractions.sharingCategoryClicked({
            item: shareDashboardType.link,
            shareResource: getTrackingSource(panel?.getRef()),
          });

          const drawer = new ShareDrawer({
            shareView: shareDashboardType.link,
            panelRef: panel.getRef(),
          });

          dashboard.showModal(drawer);
        },
      });
      subMenu.push({
        text: t('share-panel.menu.share-embed-title', 'Share embed'),
        iconClassName: 'arrow',
        shortcut: 'p e',
        onClick: () => {
          DashboardInteractions.sharingCategoryClicked({
            item: shareDashboardType.embed,
            shareResource: getTrackingSource(panel.getRef()),
          });

          const drawer = new ShareDrawer({
            shareView: shareDashboardType.embed,
            panelRef: panel.getRef(),
          });

          dashboard.showModal(drawer);
        },
      });

      if (
        contextSrv.isSignedIn &&
        config.snapshotEnabled &&
        contextSrv.hasPermission(AccessControlAction.SnapshotsCreate)
      ) {
        subMenu.push({
          text: t('share-panel.menu.share-snapshot-title', 'Share snapshot'),
          iconClassName: 'camera',
          shortcut: 'p s',
          onClick: () => {
            DashboardInteractions.sharingCategoryClicked({
              item: shareDashboardType.snapshot,
              shareResource: getTrackingSource(panel.getRef()),
            });

            const drawer = new ShareDrawer({
              shareView: shareDashboardType.snapshot,
              panelRef: panel.getRef(),
            });

            dashboard.showModal(drawer);
          },
        });
      }

      items.push({
        type: 'submenu',
        text: t('panel.header-menu.share', 'Share'),
        iconClassName: 'share-alt',
        subMenu,
        onClick: (e) => {
          e.preventDefault();
        },
      });
    } else {
      items.push({
        text: t('panel.header-menu.share', 'Share'),
        iconClassName: 'share-alt',
        onClick: () => {
          dashboard.showModal(new ShareModal({ panelRef: panel.getRef() }));
        },
        shortcut: 'p s',
      });
    }

    if (dashboard.state.isEditing && !isRepeat && !isEditingPanel) {
      moreSubMenu.push({
        text: t('panel.header-menu.duplicate', `Duplicate`),
        iconClassName: 'file-copy-alt',
        onClick: () => {
          dashboard.duplicatePanel(panel);
        },
        shortcut: 'p d',
      });
    }

    if (!isEditingPanel) {
      moreSubMenu.push({
        text: t('panel.header-menu.copy', `Copy`),
        iconClassName: 'copy',
        onClick: () => {
          dashboard.copyPanel(panel);
        },
      });
    }

    if (dashboard.state.isEditing && !isRepeat && !isEditingPanel) {
      if (isLibraryPanel(panel)) {
        moreSubMenu.push({
          text: t('panel.header-menu.unlink-library-panel', `Unlink library panel`),
          iconClassName: 'link-broken',
          onClick: () => {
            dashboard.showModal(
              new UnlinkLibraryPanelModal({
                panelRef: panel.getRef(),
              })
            );
          },
        });

        moreSubMenu.push({
          text: t('panel.header-menu.replace-library-panel', `Replace library panel`),
          iconClassName: 'library-panel',
          onClick: () => {
            dashboard.onShowAddLibraryPanelDrawer(panel.getRef());
          },
        });
      } else {
        if (config.featureToggles.newDashboardSharingComponent) {
          moreSubMenu.push({
            text: t('share-panel.menu.new-library-panel-title', 'New library panel'),
            iconClassName: 'plus-square',
            onClick: () => {
              const drawer = new ShareDrawer({
                shareView: shareDashboardType.libraryPanel,
                panelRef: panel.getRef(),
              });

              dashboard.showModal(drawer);
            },
          });
        } else {
          moreSubMenu.push({
            text: t('panel.header-menu.create-library-panel', `Create library panel`),
            onClick: () => {
              dashboard.showModal(
                new ShareModal({
                  panelRef: panel.getRef(),
                  activeTab: shareDashboardType.libraryPanel,
                })
              );
            },
          });
        }
      }
    }

    const isCreateAlertMenuOptionAvailable = getCreateAlertInMenuAvailability();

    if (isCreateAlertMenuOptionAvailable) {
      moreSubMenu.push({
        text: t('panel.header-menu.new-alert-rule', `New alert rule`),
        iconClassName: 'bell',
        onClick: (e) => onCreateAlert(panel),
      });
    }

    if (hasLegendOptions(panel.state.options) && !isEditingPanel) {
      moreSubMenu.push({
        text: panel.state.options.legend.showLegend
          ? t('panel.header-menu.hide-legend', 'Hide legend')
          : t('panel.header-menu.show-legend', 'Show legend'),
        iconClassName: panel.state.options.legend.showLegend ? 'legend-hide' : 'legend-show',
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
        iconClassName: 'question-circle',
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          onInspectPanel(panel, InspectTab.Help);
        },
      });
    }

    if (config.featureToggles.exploreMetrics) {
      await addDataTrailPanelAction(dashboard, panel, items);
    }

    if (exploreMenuItem) {
      items.push(exploreMenuItem);
    }

    items.push(getInspectMenuItem(plugin, panel, dashboard));

    // TODO: make sure that this works reliably with the reactive extension registry
    // (we need to be able to know in advance what extensions should be loaded for this extension point, and make it possible to await for them.)
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
      },
    });

    if (dashboard instanceof DashboardScene && dashboard.state.meta.canEdit) {
      inspectSubMenu.push({
        text: t('panel.header-menu.query', `Query`),
        href: getInspectUrl(panel, InspectTab.Query),
        onClick: (e) => {
          e.preventDefault();
          locationService.partial({ inspect: panel.state.key, inspectTab: InspectTab.Query });
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

  return panelLinks.map((panelLink) => {
    const updatedLink: LinkModel<VizPanel> = {
      ...panelLink,
      onClick: (e, origin) => {
        DashboardInteractions.panelLinkClicked({ has_multiple_links: panelLinks.length > 1 });
        panelLink.onClick?.(e, origin);
      },
    };
    return updatedLink;
  });
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
  try {
    const formValues = await scenesPanelToRuleFormValues(panel);
    const ruleFormUrl = urlUtil.renderUrl('/alerting/new', {
      defaults: JSON.stringify(formValues),
      returnTo: location.pathname + location.search,
    });
    locationService.push(ruleFormUrl);
  } catch (err) {
    const message = `Error getting rule values from the panel: ${getMessageFromError(err)}`;
    dispatch(notifyApp(createErrorNotification(message)));
    return;
  }
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
}

function hasLegendOptions(optionsWithLegend: unknown): optionsWithLegend is OptionsWithLegend {
  return optionsWithLegend != null && typeof optionsWithLegend === 'object' && 'legend' in optionsWithLegend;
}

const onInspectPanel = (vizPanel: VizPanel, tab?: InspectTab) => {
  locationService.partial({
    inspect: vizPanel.state.key,
    inspectTab: tab,
  });
};
