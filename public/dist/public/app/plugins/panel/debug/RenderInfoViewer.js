import { __extends } from "tslib";
import React, { Component } from 'react';
import { compareArrayValues, compareDataFrameStructures, fieldReducers, getFieldDisplayName, getFrameDisplayName, ReducerID, } from '@grafana/data';
import { IconButton } from '@grafana/ui';
var RenderInfoViewer = /** @class */ (function (_super) {
    __extends(RenderInfoViewer, _super);
    function RenderInfoViewer() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        // Intentionally not state to avoid overhead -- yes, things will be 1 tick behind
        _this.lastRender = Date.now();
        _this.counters = {
            render: 0,
            dataChanged: 0,
            schemaChanged: 0,
        };
        _this.resetCounters = function () {
            _this.counters = {
                render: 0,
                dataChanged: 0,
                schemaChanged: 0,
            };
            _this.forceUpdate();
        };
        return _this;
    }
    RenderInfoViewer.prototype.shouldComponentUpdate = function (prevProps) {
        var _a, _b;
        var _c = this.props, data = _c.data, options = _c.options;
        if (prevProps.data !== data) {
            this.counters.dataChanged++;
            if ((_a = options.counters) === null || _a === void 0 ? void 0 : _a.schemaChanged) {
                var oldSeries = (_b = prevProps.data) === null || _b === void 0 ? void 0 : _b.series;
                var series = data.series;
                if (series && oldSeries) {
                    var sameStructure = compareArrayValues(series, oldSeries, compareDataFrameStructures);
                    if (!sameStructure) {
                        this.counters.schemaChanged++;
                    }
                }
            }
        }
        return true; // always render?
    };
    RenderInfoViewer.prototype.render = function () {
        var _a;
        var _b = this.props, data = _b.data, options = _b.options;
        var showCounters = (_a = options.counters) !== null && _a !== void 0 ? _a : {};
        this.counters.render++;
        var now = Date.now();
        var elapsed = now - this.lastRender;
        this.lastRender = now;
        var reducer = fieldReducers.get(ReducerID.lastNotNull);
        return (React.createElement("div", null,
            React.createElement("div", null,
                React.createElement(IconButton, { name: "step-backward", title: "reset counters", onClick: this.resetCounters }),
                React.createElement("span", null,
                    showCounters.render && React.createElement("span", null,
                        "Render: ",
                        this.counters.render,
                        "\u00A0"),
                    showCounters.dataChanged && React.createElement("span", null,
                        "Data: ",
                        this.counters.dataChanged,
                        "\u00A0"),
                    showCounters.schemaChanged && React.createElement("span", null,
                        "Schema: ",
                        this.counters.schemaChanged,
                        "\u00A0"),
                    React.createElement("span", null,
                        "TIME: ",
                        elapsed,
                        "ms"))),
            data.series &&
                data.series.map(function (frame, idx) { return (React.createElement("div", { key: idx + "/" + frame.refId },
                    React.createElement("h4", null,
                        getFrameDisplayName(frame, idx),
                        " (",
                        frame.length,
                        ")"),
                    React.createElement("table", { className: "filter-table" },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("td", null, "Field"),
                                React.createElement("td", null, "Type"),
                                React.createElement("td", null, "Last"))),
                        React.createElement("tbody", null, frame.fields.map(function (field, idx) {
                            var v = reducer.reduce(field, false, false)[reducer.id];
                            return (React.createElement("tr", { key: idx + "/" + field.name },
                                React.createElement("td", null, getFieldDisplayName(field, frame, data.series)),
                                React.createElement("td", null, field.type),
                                React.createElement("td", null, "" + v)));
                        }))))); })));
    };
    return RenderInfoViewer;
}(Component));
export { RenderInfoViewer };
//# sourceMappingURL=RenderInfoViewer.js.map