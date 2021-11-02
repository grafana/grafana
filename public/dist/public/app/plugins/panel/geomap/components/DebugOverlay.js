import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { transform } from 'ol/proj';
import { stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';
var DebugOverlay = /** @class */ (function (_super) {
    __extends(DebugOverlay, _super);
    function DebugOverlay(props) {
        var _this = _super.call(this, props) || this;
        _this.style = getStyles(config.theme);
        _this.updateViewState = function () {
            var view = _this.props.map.getView();
            _this.setState({
                zoom: view.getZoom(),
                center: transform(view.getCenter(), view.getProjection(), 'EPSG:4326'),
            });
        };
        _this.state = { zoom: 0, center: [0, 0] };
        return _this;
    }
    DebugOverlay.prototype.componentDidMount = function () {
        this.props.map.on('moveend', this.updateViewState);
        this.updateViewState();
    };
    DebugOverlay.prototype.render = function () {
        var _a = this.state, zoom = _a.zoom, center = _a.center;
        return (React.createElement("div", { className: this.style.infoWrap },
            React.createElement("table", null,
                React.createElement("tbody", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Zoom:"),
                        React.createElement("td", null, zoom === null || zoom === void 0 ? void 0 : zoom.toFixed(1))),
                    React.createElement("tr", null,
                        React.createElement("th", null, "Center:\u00A0"),
                        React.createElement("td", null,
                            center[0].toFixed(5),
                            ", ",
                            center[1].toFixed(5)))))));
    };
    return DebugOverlay;
}(PureComponent));
export { DebugOverlay };
var getStyles = stylesFactory(function (theme) { return ({
    infoWrap: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n    background: ", ";\n    border-radius: 2px;\n    padding: 8px;\n  "], ["\n    color: ", ";\n    background: ", ";\n    border-radius: 2px;\n    padding: 8px;\n  "])), theme.colors.text, tinycolor(theme.colors.panelBg).setAlpha(0.7).toString()),
}); });
var templateObject_1;
//# sourceMappingURL=DebugOverlay.js.map