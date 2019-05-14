var FolderPageLoader = /** @class */ (function () {
    function FolderPageLoader(backendSrv) {
        this.backendSrv = backendSrv;
    }
    FolderPageLoader.prototype.load = function (ctrl, uid, activeChildId) {
        ctrl.navModel = {
            main: {
                icon: 'fa fa-folder-open',
                id: 'manage-folder',
                subTitle: 'Manage folder dashboards & permissions',
                url: '',
                text: '',
                breadcrumbs: [{ title: 'Dashboards', url: 'dashboards' }],
                children: [
                    {
                        active: activeChildId === 'manage-folder-dashboards',
                        icon: 'fa fa-fw fa-th-large',
                        id: 'manage-folder-dashboards',
                        text: 'Dashboards',
                        url: 'dashboards',
                    },
                    {
                        active: activeChildId === 'manage-folder-permissions',
                        icon: 'fa fa-fw fa-lock',
                        id: 'manage-folder-permissions',
                        text: 'Permissions',
                        url: 'dashboards/permissions',
                    },
                    {
                        active: activeChildId === 'manage-folder-settings',
                        icon: 'fa fa-fw fa-cog',
                        id: 'manage-folder-settings',
                        text: 'Settings',
                        url: 'dashboards/settings',
                    },
                ],
            },
        };
        return this.backendSrv.getFolderByUid(uid).then(function (folder) {
            ctrl.folderId = folder.id;
            var folderTitle = folder.title;
            var folderUrl = folder.url;
            ctrl.navModel.main.text = folderTitle;
            var dashTab = ctrl.navModel.main.children.find(function (child) { return child.id === 'manage-folder-dashboards'; });
            dashTab.url = folderUrl;
            if (folder.canAdmin) {
                var permTab = ctrl.navModel.main.children.find(function (child) { return child.id === 'manage-folder-permissions'; });
                permTab.url = folderUrl + '/permissions';
                var settingsTab = ctrl.navModel.main.children.find(function (child) { return child.id === 'manage-folder-settings'; });
                settingsTab.url = folderUrl + '/settings';
            }
            else {
                ctrl.navModel.main.children = [dashTab];
            }
            return folder;
        });
    };
    return FolderPageLoader;
}());
export { FolderPageLoader };
//# sourceMappingURL=FolderPageLoader.js.map