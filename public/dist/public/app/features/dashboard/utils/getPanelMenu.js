import { getTimeZone, PluginExtensionPoints, } from '@grafana/data';
import { locationService, reportInteraction, getPluginLinkExtensions } from '@grafana/runtime';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';
import { addLibraryPanel, copyPanel, duplicatePanel, removePanel, sharePanel, toggleLegend, unlinkLibraryPanel, } from 'app/features/dashboard/utils/panel';
import { InspectTab } from 'app/features/inspector/types';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { truncateTitle } from 'app/features/plugins/extensions/utils';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { store } from 'app/store/store';
import { navigateToExplore } from '../../explore/state/main';
import { getTimeSrv } from '../services/TimeSrv';
export function getPanelMenu(dashboard, panel, angularComponent) {
    var _a;
    const onViewPanel = (event) => {
        event.preventDefault();
        locationService.partial({
            viewPanel: panel.id,
        });
        reportInteraction('dashboards_panelheader_menu', { item: 'view' });
    };
    const onEditPanel = (event) => {
        event.preventDefault();
        locationService.partial({
            editPanel: panel.id,
        });
        reportInteraction('dashboards_panelheader_menu', { item: 'edit' });
    };
    const onSharePanel = (event) => {
        event.preventDefault();
        sharePanel(dashboard, panel);
        reportInteraction('dashboards_panelheader_menu', { item: 'share' });
    };
    const onAddLibraryPanel = (event) => {
        event.preventDefault();
        addLibraryPanel(dashboard, panel);
        reportInteraction('dashboards_panelheader_menu', { item: 'createLibraryPanel' });
    };
    const onUnlinkLibraryPanel = (event) => {
        event.preventDefault();
        unlinkLibraryPanel(panel);
        reportInteraction('dashboards_panelheader_menu', { item: 'unlinkLibraryPanel' });
    };
    const onInspectPanel = (tab) => {
        locationService.partial({
            inspect: panel.id,
            inspectTab: tab,
        });
        reportInteraction('dashboards_panelheader_menu', { item: 'inspect', tab: tab !== null && tab !== void 0 ? tab : InspectTab.Data });
    };
    const onMore = (event) => {
        event.preventDefault();
    };
    const onDuplicatePanel = (event) => {
        event.preventDefault();
        duplicatePanel(dashboard, panel);
        reportInteraction('dashboards_panelheader_menu', { item: 'duplicate' });
    };
    const onCopyPanel = (event) => {
        event.preventDefault();
        copyPanel(panel);
        reportInteraction('dashboards_panelheader_menu', { item: 'copy' });
    };
    const onRemovePanel = (event) => {
        event.preventDefault();
        removePanel(dashboard, panel, true);
        reportInteraction('dashboards_panelheader_menu', { item: 'remove' });
    };
    const onNavigateToExplore = (event) => {
        event.preventDefault();
        const openInNewWindow = event.ctrlKey || event.metaKey ? (url) => window.open(`${config.appSubUrl}${url}`) : undefined;
        store.dispatch(navigateToExplore(panel, {
            timeRange: getTimeSrv().timeRange(),
            getExploreUrl,
            openInNewWindow,
        }));
        reportInteraction('dashboards_panelheader_menu', { item: 'explore' });
    };
    const onToggleLegend = (event) => {
        event.preventDefault();
        toggleLegend(panel);
        reportInteraction('dashboards_panelheader_menu', { item: 'toggleLegend' });
    };
    const menu = [];
    if (!panel.isEditing) {
        menu.push({
            text: t('panel.header-menu.view', `View`),
            iconClassName: 'eye',
            onClick: onViewPanel,
            shortcut: 'v',
        });
    }
    if (dashboard.canEditPanel(panel) && !panel.isEditing) {
        menu.push({
            text: t('panel.header-menu.edit', `Edit`),
            iconClassName: 'edit',
            onClick: onEditPanel,
            shortcut: 'e',
        });
    }
    menu.push({
        text: t('panel.header-menu.share', `Share`),
        iconClassName: 'share-alt',
        onClick: onSharePanel,
        shortcut: 'p s',
    });
    if (contextSrv.hasAccessToExplore() &&
        !(panel.plugin && panel.plugin.meta.skipDataQuery) &&
        ((_a = panel.datasource) === null || _a === void 0 ? void 0 : _a.uid) !== SHARED_DASHBOARD_QUERY) {
        menu.push({
            text: t('panel.header-menu.explore', `Explore`),
            iconClassName: 'compass',
            onClick: onNavigateToExplore,
            shortcut: 'p x',
        });
    }
    const inspectMenu = [];
    // Only show these inspect actions for data plugins
    if (panel.plugin && !panel.plugin.meta.skipDataQuery) {
        inspectMenu.push({
            text: t('panel.header-menu.inspect-data', `Data`),
            onClick: (e) => onInspectPanel(InspectTab.Data),
        });
        if (dashboard.meta.canEdit) {
            inspectMenu.push({
                text: t('panel.header-menu.query', `Query`),
                onClick: (e) => onInspectPanel(InspectTab.Query),
            });
        }
    }
    inspectMenu.push({
        text: t('panel.header-menu.inspect-json', `Panel JSON`),
        onClick: (e) => onInspectPanel(InspectTab.JSON),
    });
    menu.push({
        type: 'submenu',
        text: t('panel.header-menu.inspect', `Inspect`),
        iconClassName: 'info-circle',
        onClick: (e) => {
            const currentTarget = e.currentTarget;
            const target = e.target;
            if (target === currentTarget ||
                (target instanceof HTMLElement && target.closest('[role="menuitem"]') === currentTarget)) {
                onInspectPanel();
            }
        },
        shortcut: 'i',
        subMenu: inspectMenu,
    });
    const subMenu = [];
    const canEdit = dashboard.canEditPanel(panel);
    if (!(panel.isViewing || panel.isEditing)) {
        if (canEdit) {
            subMenu.push({
                text: t('panel.header-menu.duplicate', `Duplicate`),
                onClick: onDuplicatePanel,
                shortcut: 'p d',
            });
            subMenu.push({
                text: t('panel.header-menu.copy', `Copy`),
                onClick: onCopyPanel,
            });
            if (isPanelModelLibraryPanel(panel)) {
                subMenu.push({
                    text: t('panel.header-menu.unlink-library-panel', `Unlink library panel`),
                    onClick: onUnlinkLibraryPanel,
                });
            }
            else {
                subMenu.push({
                    text: t('panel.header-menu.create-library-panel', `Create library panel`),
                    onClick: onAddLibraryPanel,
                });
            }
        }
        else if (contextSrv.isEditor) {
            // An editor but the dashboard is not editable
            subMenu.push({
                text: t('panel.header-menu.copy', `Copy`),
                onClick: onCopyPanel,
            });
        }
    }
    // add old angular panel options
    if (angularComponent) {
        const scope = angularComponent.getScope();
        const panelCtrl = scope.$$childHead.ctrl;
        const angularMenuItems = panelCtrl.getExtendedMenu();
        for (const item of angularMenuItems) {
            const reactItem = {
                text: item.text,
                href: item.href,
                shortcut: item.shortcut,
            };
            if (item.click) {
                reactItem.onClick = () => {
                    scope.$eval(item.click, { ctrl: panelCtrl });
                };
            }
            subMenu.push(reactItem);
        }
    }
    if (panel.options.legend) {
        subMenu.push({
            text: panel.options.legend.showLegend
                ? t('panel.header-menu.hide-legend', 'Hide legend')
                : t('panel.header-menu.show-legend', 'Show legend'),
            onClick: onToggleLegend,
            shortcut: 'p l',
        });
    }
    // When editing hide most actions
    if (panel.isEditing) {
        subMenu.length = 0;
    }
    if (canEdit && panel.plugin && !panel.plugin.meta.skipDataQuery) {
        subMenu.push({
            text: t('panel.header-menu.get-help', 'Get help'),
            onClick: (e) => onInspectPanel(InspectTab.Help),
        });
    }
    const { extensions } = getPluginLinkExtensions({
        extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
        context: createExtensionContext(panel, dashboard),
        limitPerPlugin: 3,
    });
    if (extensions.length > 0 && !panel.isEditing) {
        menu.push({
            text: 'Extensions',
            iconClassName: 'plug',
            type: 'submenu',
            subMenu: createExtensionSubMenu(extensions),
        });
    }
    if (subMenu.length) {
        menu.push({
            type: 'submenu',
            text: t('panel.header-menu.more', `More...`),
            iconClassName: 'cube',
            subMenu,
            onClick: onMore,
        });
    }
    if (dashboard.canEditPanel(panel) && !panel.isEditing && !panel.isViewing) {
        menu.push({ type: 'divider', text: '' });
        menu.push({
            text: t('panel.header-menu.remove', `Remove`),
            iconClassName: 'trash-alt',
            onClick: onRemovePanel,
            shortcut: 'p r',
        });
    }
    return menu;
}
function createExtensionContext(panel, dashboard) {
    return {
        id: panel.id,
        pluginId: panel.type,
        title: panel.title,
        timeRange: dashboard.time,
        timeZone: getTimeZone({
            timeZone: dashboard.timezone,
        }),
        dashboard: {
            uid: dashboard.uid,
            title: dashboard.title,
            tags: Array.from(dashboard.tags),
        },
        targets: panel.targets,
        scopedVars: panel.scopedVars,
        data: panel.getQueryRunner().getLastResult(),
    };
}
function createExtensionSubMenu(extensions) {
    const categorized = {};
    const uncategorized = [];
    for (const extension of extensions) {
        const category = extension.category;
        if (!category) {
            uncategorized.push({
                text: truncateTitle(extension.title, 25),
                href: extension.path,
                onClick: extension.onClick,
            });
            continue;
        }
        if (!Array.isArray(categorized[category])) {
            categorized[category] = [];
        }
        categorized[category].push({
            text: truncateTitle(extension.title, 25),
            href: extension.path,
            onClick: extension.onClick,
        });
    }
    const subMenu = Object.keys(categorized).reduce((subMenu, category) => {
        subMenu.push({
            text: truncateTitle(category, 25),
            type: 'group',
            subMenu: categorized[category],
        });
        return subMenu;
    }, []);
    if (uncategorized.length > 0) {
        if (subMenu.length > 0) {
            subMenu.push({
                text: 'divider',
                type: 'divider',
            });
        }
        Array.prototype.push.apply(subMenu, uncategorized);
    }
    return subMenu;
}
//# sourceMappingURL=getPanelMenu.js.map