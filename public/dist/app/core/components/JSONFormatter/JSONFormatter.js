import * as tslib_1 from "tslib";
import React, { PureComponent, createRef } from 'react';
// import JSONFormatterJS, { JSONFormatterConfiguration } from 'json-formatter-js';
import { JsonExplorer } from 'app/core/core'; // We have made some monkey-patching of json-formatter-js so we can't switch right now
var JSONFormatter = /** @class */ (function (_super) {
    tslib_1.__extends(JSONFormatter, _super);
    function JSONFormatter() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.wrapperRef = createRef();
        _this.renderJson = function () {
            var _a = _this.props, json = _a.json, config = _a.config, open = _a.open, onDidRender = _a.onDidRender;
            var wrapperEl = _this.wrapperRef.current;
            var formatter = new JsonExplorer(json, open, config);
            var hasChildren = wrapperEl.hasChildNodes();
            if (hasChildren) {
                wrapperEl.replaceChild(formatter.render(), wrapperEl.lastChild);
            }
            else {
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