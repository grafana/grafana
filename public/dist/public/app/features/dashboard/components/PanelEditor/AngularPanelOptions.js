import { __extends } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
// Utils and services
import { getAngularLoader } from '@grafana/runtime';
import { changePanelPlugin } from 'app/features/panel/state/actions';
import { getSectionOpenState, saveSectionOpenState } from './state/utils';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
var mapStateToProps = function (state, props) {
    var _a;
    return ({
        angularPanelComponent: (_a = getPanelStateForModel(state, props.panel)) === null || _a === void 0 ? void 0 : _a.angularComponent,
    });
};
var mapDispatchToProps = { changePanelPlugin: changePanelPlugin };
var connector = connect(mapStateToProps, mapDispatchToProps);
var AngularPanelOptionsUnconnected = /** @class */ (function (_super) {
    __extends(AngularPanelOptionsUnconnected, _super);
    function AngularPanelOptionsUnconnected(props) {
        return _super.call(this, props) || this;
    }
    AngularPanelOptionsUnconnected.prototype.componentDidMount = function () {
        this.loadAngularOptions();
    };
    AngularPanelOptionsUnconnected.prototype.componentDidUpdate = function (prevProps) {
        if (this.props.plugin !== prevProps.plugin ||
            this.props.angularPanelComponent !== prevProps.angularPanelComponent) {
            this.cleanUpAngularOptions();
        }
        this.loadAngularOptions();
    };
    AngularPanelOptionsUnconnected.prototype.componentWillUnmount = function () {
        this.cleanUpAngularOptions();
    };
    AngularPanelOptionsUnconnected.prototype.cleanUpAngularOptions = function () {
        if (this.angularOptions) {
            this.angularOptions.destroy();
            this.angularOptions = null;
        }
    };
    AngularPanelOptionsUnconnected.prototype.loadAngularOptions = function () {
        var _this = this;
        var _a = this.props, panel = _a.panel, angularPanelComponent = _a.angularPanelComponent, changePanelPlugin = _a.changePanelPlugin;
        if (!this.element || !angularPanelComponent || this.angularOptions) {
            return;
        }
        var scope = angularPanelComponent.getScope();
        // When full page reloading in edit mode the angular panel has on fully compiled and instantiated yet
        if (!scope.$$childHead) {
            setTimeout(function () {
                _this.forceUpdate();
            });
            return;
        }
        var panelCtrl = scope.$$childHead.ctrl;
        panelCtrl.initEditMode();
        panelCtrl.onPluginTypeChange = function (plugin) {
            changePanelPlugin({ panel: panel, pluginId: plugin.id });
        };
        var template = '';
        for (var i = 0; i < panelCtrl.editorTabs.length; i++) {
            var tab = panelCtrl.editorTabs[i];
            tab.isOpen = getSectionOpenState(tab.title, i === 0);
            template += "\n      <div class=\"panel-options-group\" ng-cloak>\n        <div class=\"panel-options-group__header\" ng-click=\"toggleOptionGroup(" + i + ")\" aria-label=\"" + tab.title + " section\">\n          <div class=\"panel-options-group__icon\">\n            <icon name=\"ctrl.editorTabs[" + i + "].isOpen ? 'angle-down' : 'angle-right'\"></icon>\n          </div>\n          <div class=\"panel-options-group__title\">" + tab.title + "</div>\n        </div>\n        <div class=\"panel-options-group__body\" ng-if=\"ctrl.editorTabs[" + i + "].isOpen\">\n          <panel-editor-tab editor-tab=\"ctrl.editorTabs[" + i + "]\" ctrl=\"ctrl\"></panel-editor-tab>\n        </div>\n      </div>\n      ";
        }
        var loader = getAngularLoader();
        var scopeProps = {
            ctrl: panelCtrl,
            toggleOptionGroup: function (index) {
                var tab = panelCtrl.editorTabs[index];
                tab.isOpen = !tab.isOpen;
                saveSectionOpenState(tab.title, tab.isOpen);
            },
        };
        this.angularOptions = loader.load(this.element, scopeProps, template);
        this.angularOptions.digest();
    };
    AngularPanelOptionsUnconnected.prototype.render = function () {
        var _this = this;
        return React.createElement("div", { ref: function (elem) { return (_this.element = elem); } });
    };
    return AngularPanelOptionsUnconnected;
}(PureComponent));
export { AngularPanelOptionsUnconnected };
export var AngularPanelOptions = connect(mapStateToProps, mapDispatchToProps)(AngularPanelOptionsUnconnected);
//# sourceMappingURL=AngularPanelOptions.js.map