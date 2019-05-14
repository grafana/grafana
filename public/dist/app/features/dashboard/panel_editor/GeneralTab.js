import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { getAngularLoader } from 'app/core/services/AngularLoader';
import { EditorTabBody } from './EditorTabBody';
import './../../panel/GeneralTabCtrl';
var GeneralTab = /** @class */ (function (_super) {
    tslib_1.__extends(GeneralTab, _super);
    function GeneralTab(props) {
        return _super.call(this, props) || this;
    }
    GeneralTab.prototype.componentDidMount = function () {
        if (!this.element) {
            return;
        }
        var panel = this.props.panel;
        var loader = getAngularLoader();
        var template = '<panel-general-tab />';
        var scopeProps = {
            ctrl: {
                panel: panel,
            },
        };
        this.component = loader.load(this.element, scopeProps, template);
    };
    GeneralTab.prototype.componentWillUnmount = function () {
        if (this.component) {
            this.component.destroy();
        }
    };
    GeneralTab.prototype.render = function () {
        var _this = this;
        return (React.createElement(EditorTabBody, { heading: "General", toolbarItems: [] },
            React.createElement("div", { ref: function (element) { return (_this.element = element); } })));
    };
    return GeneralTab;
}(PureComponent));
export { GeneralTab };
//# sourceMappingURL=GeneralTab.js.map