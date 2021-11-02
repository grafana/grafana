import config from '../../core/config';
import { extend } from 'lodash';
import coreModule from 'app/core/core_module';
import { rangeUtil } from '@grafana/data';
import { AccessControlAction } from 'app/types';
var User = /** @class */ (function () {
    function User() {
        this.id = 0;
        this.isGrafanaAdmin = false;
        this.isSignedIn = false;
        this.orgRole = '';
        this.orgId = 0;
        this.orgName = '';
        this.login = '';
        this.orgCount = 0;
        this.timezone = '';
        this.fiscalYearStartMonth = 0;
        this.helpFlags1 = 0;
        this.lightTheme = false;
        this.hasEditPermissionInFolders = false;
        this.email = undefined;
        if (config.bootData.user) {
            extend(this, config.bootData.user);
        }
    }
    return User;
}());
export { User };
var ContextSrv = /** @class */ (function () {
    function ContextSrv() {
        this.sidemenuSmallBreakpoint = false;
        if (!config.bootData) {
            config.bootData = { user: {}, settings: {} };
        }
        this.user = new User();
        this.isSignedIn = this.user.isSignedIn;
        this.isGrafanaAdmin = this.user.isGrafanaAdmin;
        this.isEditor = this.hasRole('Editor') || this.hasRole('Admin');
        this.hasEditPermissionInFolders = this.user.hasEditPermissionInFolders;
        this.minRefreshInterval = config.minRefreshInterval;
    }
    /**
     * Indicate the user has been logged out
     */
    ContextSrv.prototype.setLoggedOut = function () {
        this.user.isSignedIn = false;
        this.isSignedIn = false;
    };
    ContextSrv.prototype.hasRole = function (role) {
        return this.user.orgRole === role;
    };
    // Checks whether user has required permission
    ContextSrv.prototype.hasPermission = function (action) {
        var _a;
        // Fallback if access control disabled
        if (!config.featureToggles['accesscontrol']) {
            return true;
        }
        return !!((_a = this.user.permissions) === null || _a === void 0 ? void 0 : _a[action]);
    };
    ContextSrv.prototype.isGrafanaVisible = function () {
        return document.visibilityState === undefined || document.visibilityState === 'visible';
    };
    // checks whether the passed interval is longer than the configured minimum refresh rate
    ContextSrv.prototype.isAllowedInterval = function (interval) {
        if (!config.minRefreshInterval) {
            return true;
        }
        return rangeUtil.intervalToMs(interval) >= rangeUtil.intervalToMs(config.minRefreshInterval);
    };
    ContextSrv.prototype.getValidInterval = function (interval) {
        if (!this.isAllowedInterval(interval)) {
            return config.minRefreshInterval;
        }
        return interval;
    };
    ContextSrv.prototype.hasAccessToExplore = function () {
        if (config.featureToggles['accesscontrol']) {
            return this.hasPermission(AccessControlAction.DataSourcesExplore);
        }
        return (this.isEditor || config.viewersCanEdit) && config.exploreEnabled;
    };
    ContextSrv.prototype.hasAccess = function (action, fallBack) {
        if (!config.featureToggles['accesscontrol']) {
            return fallBack;
        }
        return this.hasPermission(action);
    };
    // evaluates access control permissions, granting access if the user has any of them; uses fallback if access control is disabled
    ContextSrv.prototype.evaluatePermission = function (fallback, actions) {
        var _this = this;
        if (!config.featureToggles['accesscontrol']) {
            return fallback();
        }
        if (actions.some(function (action) { return _this.hasPermission(action); })) {
            return [];
        }
        // Hack to reject when user does not have permission
        return ['Reject'];
    };
    return ContextSrv;
}());
export { ContextSrv };
var contextSrv = new ContextSrv();
export { contextSrv };
export var setContextSrv = function (override) {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('contextSrv can be only overriden in test environment');
    }
    contextSrv = override;
};
coreModule.factory('contextSrv', function () {
    return contextSrv;
});
//# sourceMappingURL=context_srv.js.map