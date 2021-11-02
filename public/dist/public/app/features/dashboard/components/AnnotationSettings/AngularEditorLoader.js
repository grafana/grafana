import { __extends } from "tslib";
import React from 'react';
import { getAngularLoader } from '@grafana/runtime';
var AngularEditorLoader = /** @class */ (function (_super) {
    __extends(AngularEditorLoader, _super);
    function AngularEditorLoader() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.ref = null;
        return _this;
    }
    AngularEditorLoader.prototype.componentWillUnmount = function () {
        if (this.angularComponent) {
            this.angularComponent.destroy();
        }
    };
    AngularEditorLoader.prototype.componentDidMount = function () {
        if (this.ref) {
            this.loadAngular();
        }
    };
    AngularEditorLoader.prototype.componentDidUpdate = function (prevProps) {
        var _a;
        if (prevProps.datasource !== this.props.datasource) {
            this.loadAngular();
        }
        if (this.scopeProps && this.scopeProps.ctrl.currentAnnotation !== this.props.annotation) {
            this.scopeProps.ctrl.ignoreNextWatcherFiring = true;
            this.scopeProps.ctrl.currentAnnotation = this.props.annotation;
            (_a = this.angularComponent) === null || _a === void 0 ? void 0 : _a.digest();
        }
    };
    AngularEditorLoader.prototype.loadAngular = function () {
        var _this = this;
        if (this.angularComponent) {
            this.angularComponent.destroy();
            this.scopeProps = undefined;
        }
        var loader = getAngularLoader();
        var template = "<plugin-component ng-if=\"!ctrl.currentDatasource.annotations\" type=\"annotations-query-ctrl\"> </plugin-component>";
        var scopeProps = {
            ctrl: {
                currentDatasource: this.props.datasource,
                currentAnnotation: this.props.annotation,
                ignoreNextWatcherFiring: false,
            },
        };
        this.angularComponent = loader.load(this.ref, scopeProps, template);
        this.angularComponent.digest();
        this.angularComponent.getScope().$watch(function () {
            // To avoid recursive loop when the annotation is updated from outside angular in componentDidUpdate
            if (scopeProps.ctrl.ignoreNextWatcherFiring) {
                scopeProps.ctrl.ignoreNextWatcherFiring = false;
                return;
            }
            _this.props.onChange(scopeProps.ctrl.currentAnnotation);
        });
        this.scopeProps = scopeProps;
    };
    AngularEditorLoader.prototype.render = function () {
        var _this = this;
        return React.createElement("div", { ref: function (element) { return (_this.ref = element); } });
    };
    return AngularEditorLoader;
}(React.PureComponent));
export { AngularEditorLoader };
//# sourceMappingURL=AngularEditorLoader.js.map