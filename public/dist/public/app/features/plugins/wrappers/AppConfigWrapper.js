import { __extends } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { cloneDeep, extend } from 'lodash';
import { Button } from '@grafana/ui';
import { deprecationWarning } from '@grafana/data';
import { getAngularLoader, getBackendSrv } from '@grafana/runtime';
import { css } from '@emotion/css';
var AppConfigCtrlWrapper = /** @class */ (function (_super) {
    __extends(AppConfigCtrlWrapper, _super);
    function AppConfigCtrlWrapper(props) {
        var _this = _super.call(this, props) || this;
        _this.element = null;
        // Needed for angular scope
        _this.preUpdateHook = function () { return Promise.resolve(); };
        _this.postUpdateHook = function () { return Promise.resolve(); };
        //-----------------------------------------------------------
        // Copied from plugin_edit_ctrl
        //-----------------------------------------------------------
        _this.update = function () {
            var pluginId = _this.model.id;
            _this.preUpdateHook()
                .then(function () {
                var updateCmd = extend({
                    enabled: _this.model.enabled,
                    pinned: _this.model.pinned,
                    jsonData: _this.model.jsonData,
                    secureJsonData: _this.model.secureJsonData,
                }, {});
                return getBackendSrv().post("/api/plugins/" + pluginId + "/settings", updateCmd);
            })
                .then(_this.postUpdateHook)
                .then(function (res) {
                window.location.href = window.location.href;
            });
        };
        _this.setPreUpdateHook = function (callback) {
            _this.preUpdateHook = callback;
        };
        _this.setPostUpdateHook = function (callback) {
            _this.postUpdateHook = callback;
        };
        // Stub to avoid unknown function in legacy code
        _this.importDashboards = function () {
            deprecationWarning('AppConfig', 'importDashboards()');
            return Promise.resolve();
        };
        _this.enable = function () {
            _this.model.enabled = true;
            _this.model.pinned = true;
            _this.update();
        };
        _this.disable = function () {
            _this.model.enabled = false;
            _this.model.pinned = false;
            _this.update();
        };
        _this.state = {
            angularCtrl: null,
            refresh: 0,
        };
        return _this;
    }
    AppConfigCtrlWrapper.prototype.componentDidMount = function () {
        var _this = this;
        // Force a reload after the first mount -- is there a better way to do this?
        setTimeout(function () {
            _this.setState({ refresh: _this.state.refresh + 1 });
        }, 5);
    };
    AppConfigCtrlWrapper.prototype.componentDidUpdate = function (prevProps) {
        if (!this.element || this.state.angularCtrl) {
            return;
        }
        // Set a copy of the meta
        this.model = cloneDeep(this.props.app.meta);
        var loader = getAngularLoader();
        var template = '<plugin-component type="app-config-ctrl"></plugin-component>';
        var scopeProps = {
            ctrl: this,
            // used by angular injectorMonkeyPatch to detect this scenario
            isAppConfigCtrl: true,
        };
        var angularCtrl = loader.load(this.element, scopeProps, template);
        this.setState({ angularCtrl: angularCtrl });
    };
    AppConfigCtrlWrapper.prototype.render = function () {
        var _this = this;
        var model = this.model;
        var withRightMargin = css({ marginRight: '8px' });
        return (React.createElement("div", null,
            React.createElement("div", { ref: function (element) { return (_this.element = element); } }),
            React.createElement("br", null),
            React.createElement("br", null),
            model && (React.createElement("div", { className: "gf-form" },
                !model.enabled && (React.createElement(Button, { variant: "primary", onClick: this.enable, className: withRightMargin }, "Enable")),
                model.enabled && (React.createElement(Button, { variant: "primary", onClick: this.update, className: withRightMargin }, "Update")),
                model.enabled && (React.createElement(Button, { variant: "destructive", onClick: this.disable, className: withRightMargin }, "Disable"))))));
    };
    return AppConfigCtrlWrapper;
}(PureComponent));
export { AppConfigCtrlWrapper };
//# sourceMappingURL=AppConfigWrapper.js.map