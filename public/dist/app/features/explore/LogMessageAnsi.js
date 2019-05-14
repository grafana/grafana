import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import ansicolor from 'vendor/ansicolor/ansicolor';
function convertCSSToStyle(css) {
    return css.split(/;\s*/).reduce(function (accumulated, line) {
        var match = line.match(/([^:\s]+)\s*:\s*(.+)/);
        if (match && match[1] && match[2]) {
            var key = match[1].replace(/-(a-z)/g, function (_, character) { return character.toUpperCase(); });
            accumulated[key] = match[2];
        }
        return accumulated;
    }, {});
}
var LogMessageAnsi = /** @class */ (function (_super) {
    tslib_1.__extends(LogMessageAnsi, _super);
    function LogMessageAnsi() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            chunks: [],
            prevValue: '',
        };
        return _this;
    }
    LogMessageAnsi.getDerivedStateFromProps = function (props, state) {
        if (props.value === state.prevValue) {
            return null;
        }
        var parsed = ansicolor.parse(props.value);
        return {
            chunks: parsed.spans.map(function (span) {
                return span.css
                    ? {
                        style: convertCSSToStyle(span.css),
                        text: span.text,
                    }
                    : { text: span.text };
            }),
            prevValue: props.value,
        };
    };
    LogMessageAnsi.prototype.render = function () {
        var chunks = this.state.chunks;
        return chunks.map(function (chunk, index) {
            return chunk.style ? (React.createElement("span", { key: index, style: chunk.style }, chunk.text)) : (chunk.text);
        });
    };
    return LogMessageAnsi;
}(PureComponent));
export { LogMessageAnsi };
//# sourceMappingURL=LogMessageAnsi.js.map