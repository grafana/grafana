import { __extends } from "tslib";
import React, { PureComponent, createRef } from 'react';
import { JsonExplorer } from './json_explorer/json_explorer'; // We have made some monkey-patching of json-formatter-js so we can't switch right now
var JSONFormatter = /** @class */ (function (_super) {
    __extends(JSONFormatter, _super);
    function JSONFormatter() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.wrapperRef = createRef();
        _this.renderJson = function () {
            var _a = _this.props, json = _a.json, config = _a.config, open = _a.open, onDidRender = _a.onDidRender;
            var wrapperEl = _this.wrapperRef.current;
            var formatter = new JsonExplorer(json, open, config);
            // @ts-ignore
            var hasChildren = wrapperEl.hasChildNodes();
            if (hasChildren) {
                // @ts-ignore
                wrapperEl.replaceChild(formatter.render(), wrapperEl.lastChild);
            }
            else {
                // @ts-ignore
                wrapperEl.appendChild(formatter.render());
            }
            if (onDidRender) {
                onDidRender(formatter.json);
            }
        };
        return _this;
    }
    JSONFormatter.prototype.componentDidMount = function () {
        this.renderJson();
    };
    JSONFormatter.prototype.componentDidUpdate = function () {
        this.renderJson();
    };
    JSONFormatter.prototype.render = function () {
        var className = this.props.className;
        return React.createElement("div", { className: className, ref: this.wrapperRef });
    };
    JSONFormatter.defaultProps = {
        open: 3,
        config: {
            animateOpen: true,
        },
    };
    return JSONFormatter;
}(PureComponent));
export { JSONFormatter };
//# sourceMappingURL=JSONFormatter.js.map