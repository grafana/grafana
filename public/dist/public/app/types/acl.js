import { OrgRole } from '@grafana/data';
export var TeamPermissionLevel;
(function (TeamPermissionLevel) {
    TeamPermissionLevel[TeamPermissionLevel["Admin"] = 4] = "Admin";
    TeamPermissionLevel[TeamPermissionLevel["Editor"] = 2] = "Editor";
    TeamPermissionLevel[TeamPermissionLevel["Member"] = 0] = "Member";
    TeamPermissionLevel[TeamPermissionLevel["Viewer"] = 1] = "Viewer";
})(TeamPermissionLevel || (TeamPermissionLevel = {}));
export { OrgRole as OrgRole };
export var PermissionLevel;
(function (PermissionLevel) {
    PermissionLevel[PermissionLevel["View"] = 1] = "View";
    PermissionLevel[PermissionLevel["Edit"] = 2] = "Edit";
    PermissionLevel[PermissionLevel["Admin"] = 4] = "Admin";
})(PermissionLevel || (PermissionLevel = {}));
export var PermissionLevelString;
(function (PermissionLevelString) {
    PermissionLevelString["View"] = "View";
    PermissionLevelString["Edit"] = "Edit";
    PermissionLevelString["Admin"] = "Admin";
})(PermissionLevelString || (PermissionLevelString = {}));
export var SearchQueryType;
(function (SearchQueryType) {
    SearchQueryType["Folder"] = "dash-folder";
    SearchQueryType["Dashboard"] = "dash-db";
    SearchQueryType["AlertFolder"] = "dash-folder-alerting";
})(SearchQueryType || (SearchQueryType = {}));
export var DataSourcePermissionLevel;
(function (DataSourcePermissionLevel) {
    DataSourcePermissionLevel[DataSourcePermissionLevel["Query"] = 1] = "Query";
    DataSourcePermissionLevel[DataSourcePermissionLevel["Admin"] = 2] = "Admin";
})(DataSourcePermissionLevel || (DataSourcePermissionLevel = {}));
export var AclTarget;
(function (AclTarget) {
    AclTarget["Team"] = "Team";
    AclTarget["User"] = "User";
    AclTarget["ServiceAccount"] = "ServiceAccount";
    AclTarget["Viewer"] = "Viewer";
    AclTarget["Editor"] = "Editor";
})(AclTarget || (AclTarget = {}));
export const dataSourceAclLevels = [
    { value: DataSourcePermissionLevel.Query, label: 'Query', description: 'Can query data source.' },
];
export const dashboardAclTargets = [
    { value: AclTarget.Team, label: 'Team' },
    { value: AclTarget.User, label: 'User' },
    { value: AclTarget.Viewer, label: 'Everyone With Viewer Role' },
    { value: AclTarget.Editor, label: 'Everyone With Editor Role' },
];
export const dashboardPermissionLevels = [
    { value: PermissionLevel.View, label: PermissionLevelString.View, description: 'Can view dashboards.' },
    {
        value: PermissionLevel.Edit,
        label: PermissionLevelString.Edit,
        description: 'Can add, edit and delete dashboards.',
    },
    {
        value: PermissionLevel.Admin,
        label: 'Admin',
        description: 'Can add/remove permissions and can add, edit and delete dashboards.',
    },
];
export const teamsPermissionLevels = [
    { value: TeamPermissionLevel.Member, label: 'Member', description: 'Is team member' },
    {
        value: TeamPermissionLevel.Admin,
        label: 'Admin',
        description: 'Can add/remove permissions, members and delete team.',
    },
];
//# sourceMappingURL=acl.js.map