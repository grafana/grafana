import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { config } from '@grafana/runtime';
import { stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
var GeomapOverlay = /** @class */ (function (_super) {
    __extends(GeomapOverlay, _super);
    function GeomapOverlay(props) {
        var _this = _super.call(this, props) || this;
        _this.style = getStyles(config.theme);
        return _this;
    }
    GeomapOverlay.prototype.render = function () {
        var _a = this.props, topRight = _a.topRight, bottomLeft = _a.bottomLeft;
        return (React.createElement("div", { className: this.style.overlay },
            Boolean(topRight === null || topRight === void 0 ? void 0 : topRight.length) && React.createElement("div", { className: this.style.TR }, topRight),
            Boolean(bottomLeft === null || bottomLeft === void 0 ? void 0 : bottomLeft.length) && React.createElement("div", { className: this.style.BL }, bottomLeft)));
    };
    return GeomapOverlay;
}(PureComponent));
export { GeomapOverlay };
var getStyles = stylesFactory(function (theme) { return ({
    overlay: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    position: absolute;\n    width: 100%;\n    height: 100%;\n    z-index: 500;\n    pointer-events: none;\n  "], ["\n    position: absolute;\n    width: 100%;\n    height: 100%;\n    z-index: 500;\n    pointer-events: none;\n  "]))),
    TR: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    position: absolute;\n    top: 8px;\n    right: 8px;\n    pointer-events: auto;\n  "], ["\n    position: absolute;\n    top: 8px;\n    right: 8px;\n    pointer-events: auto;\n  "]))),
    BL: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    position: absolute;\n    bottom: 8px;\n    left: 8px;\n    pointer-events: auto;\n  "], ["\n    position: absolute;\n    bottom: 8px;\n    left: 8px;\n    pointer-events: auto;\n  "]))),
}); });
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=GeomapOverlay.js.map