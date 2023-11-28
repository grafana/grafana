import { config } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { getNavSubTitle } from 'app/core/utils/navBarItem-translations';
import { newBrowseDashboardsEnabled } from 'app/features/browse-dashboards/featureFlag';
import { AccessControlAction } from 'app/types';
export const FOLDER_ID = 'manage-folder';
export const getDashboardsTabID = (folderUID) => `folder-dashboards-${folderUID}`;
export const getLibraryPanelsTabID = (folderUID) => `folder-library-panels-${folderUID}`;
export const getAlertingTabID = (folderUID) => `folder-alerting-${folderUID}`;
export const getPermissionsTabID = (folderUID) => `folder-permissions-${folderUID}`;
export const getSettingsTabID = (folderUID) => `folder-settings-${folderUID}`;
export function buildNavModel(folder, parents = folder.parents) {
    const model = {
        icon: 'folder',
        id: FOLDER_ID,
        subTitle: getNavSubTitle('manage-folder'),
        url: folder.url,
        text: folder.title,
        children: [
            {
                active: false,
                icon: 'apps',
                id: getDashboardsTabID(folder.uid),
                text: t('browse-dashboards.manage-folder-nav.dashboards', 'Dashboards'),
                url: folder.url,
            },
        ],
    };
    if (parents && parents.length > 0) {
        const parent = parents[parents.length - 1];
        const remainingParents = parents.slice(0, parents.length - 1);
        model.parentItem = buildNavModel(parent, remainingParents);
    }
    model.children.push({
        active: false,
        icon: 'library-panel',
        id: getLibraryPanelsTabID(folder.uid),
        text: t('browse-dashboards.manage-folder-nav.panels', 'Panels'),
        url: `${folder.url}/library-panels`,
    });
    if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead) && config.unifiedAlertingEnabled) {
        model.children.push({
            active: false,
            icon: 'bell',
            id: getAlertingTabID(folder.uid),
            text: t('browse-dashboards.manage-folder-nav.alert-rules', 'Alert rules'),
            url: `${folder.url}/alerting`,
        });
    }
    if (!newBrowseDashboardsEnabled()) {
        if (folder.canAdmin) {
            model.children.push({
                active: false,
                icon: 'lock',
                id: getPermissionsTabID(folder.uid),
                text: t('browse-dashboards.manage-folder-nav.permissions', 'Permissions'),
                url: `${folder.url}/permissions`,
            });
        }
        if (folder.canSave) {
            model.children.push({
                active: false,
                icon: 'cog',
                id: getSettingsTabID(folder.uid),
                text: t('browse-dashboards.manage-folder-nav.settings', 'Settings'),
                url: `${folder.url}/settings`,
            });
        }
    }
    return model;
}
export function getLoadingNav(tabIndex) {
    const main = buildNavModel({
        created: '',
        createdBy: '',
        hasAcl: false,
        updated: '',
        updatedBy: '',
        id: 1,
        uid: 'loading',
        title: 'Loading',
        url: 'url',
        canSave: true,
        canEdit: true,
        canAdmin: true,
        canDelete: true,
        version: 0,
    });
    main.children[tabIndex].active = true;
    return {
        main: main,
        node: main.children[tabIndex],
    };
}
//# sourceMappingURL=navModel.js.map