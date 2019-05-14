import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import _ from 'lodash';
import { getAngularLoader } from 'app/core/services/AngularLoader';
var PluginSettings = /** @class */ (function (_super) {
    tslib_1.__extends(PluginSettings, _super);
    function PluginSettings(props) {
        var _this = _super.call(this, props) || this;
        _this.onModelChanged = function (dataSource) {
            _this.props.onModelChange(dataSource);
        };
        _this.scopeProps = {
            ctrl: { datasourceMeta: props.dataSourceMeta, current: _.cloneDeep(props.dataSource) },
            onModelChanged: _this.onModelChanged,
        };
        return _this;
    }
    PluginSettings.prototype.componentDidMount = function () {
        if (!this.element) {
            return;
        }
        var loader = getAngularLoader();
        var template = '<plugin-component type="datasource-config-ctrl" />';
        this.component = loader.load(this.element, this.scopeProps, template);
    };
    PluginSettings.prototype.componentDidUpdate = function (prevProps) {
        if (this.props.dataSource !== prevProps.dataSource) {
            this.scopeProps.ctrl.current = _.cloneDeep(this.props.dataSource);
            this.component.digest();
        }
    };
    PluginSettings.prototype.componentWillUnmount = function () {
        if (this.component) {
            this.component.destroy();
        }
    };
    PluginSettings.prototype.render = function () {
        var _this = this;
        return React.createElement("div", { ref: function (element) { return (_this.element = element); } });
    };
    return PluginSettings;
}(PureComponent));
export { PluginSettings };
export default PluginSettings;
//# sourceMappingURL=PluginSettings.js.map