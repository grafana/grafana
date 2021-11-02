import { __values } from "tslib";
import { store } from 'app/store/store';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { addLibraryPanel, copyPanel, duplicatePanel, removePanel, sharePanel, unlinkLibraryPanel, } from 'app/features/dashboard/utils/panel';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { contextSrv } from '../../../core/services/context_srv';
import { navigateToExplore } from '../../explore/state/main';
import { getExploreUrl } from '../../../core/utils/explore';
import { getTimeSrv } from '../services/TimeSrv';
import config from 'app/core/config';
export function getPanelMenu(dashboard, panel, angularComponent) {
    var e_1, _a;
    var onViewPanel = function (event) {
        event.preventDefault();
        locationService.partial({
            viewPanel: panel.id,
        });
    };
    var onEditPanel = function (event) {
        event.preventDefault();
        locationService.partial({
            editPanel: panel.id,
        });
    };
    var onSharePanel = function (event) {
        event.preventDefault();
        sharePanel(dashboard, panel);
    };
    var onAddLibraryPanel = function (event) {
        event.preventDefault();
        addLibraryPanel(dashboard, panel);
    };
    var onUnlinkLibraryPanel = function (event) {
        event.preventDefault();
        unlinkLibraryPanel(panel);
    };
    var onInspectPanel = function (tab) {
        locationService.partial({
            inspect: panel.id,
            inspectTab: tab,
        });
    };
    var onMore = function (event) {
        event.preventDefault();
    };
    var onDuplicatePanel = function (event) {
        event.preventDefault();
        duplicatePanel(dashboard, panel);
    };
    var onCopyPanel = function (event) {
        event.preventDefault();
        copyPanel(panel);
    };
    var onRemovePanel = function (event) {
        event.preventDefault();
        removePanel(dashboard, panel, true);
    };
    var onNavigateToExplore = function (event) {
        event.preventDefault();
        var openInNewWindow = event.ctrlKey || event.metaKey ? function (url) { return window.open("" + config.appSubUrl + url); } : undefined;
        store.dispatch(navigateToExplore(panel, { getDataSourceSrv: getDataSourceSrv, getTimeSrv: getTimeSrv, getExploreUrl: getExploreUrl, openInNewWindow: openInNewWindow }));
    };
    var menu = [];
    if (!panel.isEditing) {
        menu.push({
            text: 'View',
            iconClassName: 'eye',
            onClick: onViewPanel,
            shortcut: 'v',
        });
    }
    if (dashboard.canEditPanel(panel) && !panel.isEditing) {
        menu.push({
            text: 'Edit',
            iconClassName: 'edit',
            onClick: onEditPanel,
            shortcut: 'e',
        });
    }
    menu.push({
        text: 'Share',
        iconClassName: 'share-alt',
        onClick: onSharePanel,
        shortcut: 'p s',
    });
    if (contextSrv.hasAccessToExplore() && !(panel.plugin && panel.plugin.meta.skipDataQuery)) {
        menu.push({
            text: 'Explore',
            iconClassName: 'compass',
            shortcut: 'x',
            onClick: onNavigateToExplore,
        });
    }
    var inspectMenu = [];
    // Only show these inspect actions for data plugins
    if (panel.plugin && !panel.plugin.meta.skipDataQuery) {
        inspectMenu.push({
            text: 'Data',
            onClick: function (e) { return onInspectPanel('data'); },
        });
        if (dashboard.meta.canEdit) {
            inspectMenu.push({
                text: 'Query',
                onClick: function (e) { return onInspectPanel('query'); },
            });
        }
    }
    inspectMenu.push({
        text: 'Panel JSON',
        onClick: function (e) { return onInspectPanel('json'); },
    });
    menu.push({
        type: 'submenu',
        text: 'Inspect',
        iconClassName: 'info-circle',
        onClick: function (e) { return onInspectPanel(); },
        shortcut: 'i',
        subMenu: inspectMenu,
    });
    var subMenu = [];
    if (dashboard.canEditPanel(panel) && !(panel.isViewing || panel.isEditing)) {
        subMenu.push({
            text: 'Duplicate',
            onClick: onDuplicatePanel,
            shortcut: 'p d',
        });
        subMenu.push({
            text: 'Copy',
            onClick: onCopyPanel,
        });
        if (isPanelModelLibraryPanel(panel)) {
            subMenu.push({
                text: 'Unlink library panel',
                onClick: onUnlinkLibraryPanel,
            });
        }
        else {
            subMenu.push({
                text: 'Create library panel',
                onClick: onAddLibraryPanel,
            });
        }
    }
    // add old angular panel options
    if (angularComponent) {
        var scope_1 = angularComponent.getScope();
        var panelCtrl_1 = scope_1.$$childHead.ctrl;
        var angularMenuItems = panelCtrl_1.getExtendedMenu();
        var _loop_1 = function (item) {
            var reactItem = {
                text: item.text,
                href: item.href,
                shortcut: item.shortcut,
            };
            if (item.click) {
                reactItem.onClick = function () {
                    scope_1.$eval(item.click, { ctrl: panelCtrl_1 });
                };
            }
            subMenu.push(reactItem);
        };
        try {
            for (var angularMenuItems_1 = __values(angularMenuItems), angularMenuItems_1_1 = angularMenuItems_1.next(); !angularMenuItems_1_1.done; angularMenuItems_1_1 = angularMenuItems_1.next()) {
                var item = angularMenuItems_1_1.value;
                _loop_1(item);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (angularMenuItems_1_1 && !angularMenuItems_1_1.done && (_a = angularMenuItems_1.return)) _a.call(angularMenuItems_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    if (!panel.isEditing && subMenu.length) {
        menu.push({
            type: 'submenu',
            text: 'More...',
            iconClassName: 'cube',
            subMenu: subMenu,
            onClick: onMore,
        });
    }
    if (dashboard.canEditPanel(panel) && !panel.isEditing && !panel.isViewing) {
        menu.push({ type: 'divider', text: '' });
        menu.push({
            text: 'Remove',
            iconClassName: 'trash-alt',
            onClick: onRemovePanel,
            shortcut: 'p r',
        });
    }
    return menu;
}
//# sourceMappingURL=getPanelMenu.js.map