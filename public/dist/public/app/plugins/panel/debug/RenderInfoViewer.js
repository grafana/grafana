import React, { Component } from 'react';
import { compareArrayValues, compareDataFrameStructures, fieldReducers, getFieldDisplayName, getFrameDisplayName, ReducerID, } from '@grafana/data';
import { IconButton } from '@grafana/ui';
export class RenderInfoViewer extends Component {
    constructor() {
        super(...arguments);
        // Intentionally not state to avoid overhead -- yes, things will be 1 tick behind
        this.lastRender = Date.now();
        this.counters = {
            render: 0,
            dataChanged: 0,
            schemaChanged: 0,
        };
        this.resetCounters = () => {
            this.counters = {
                render: 0,
                dataChanged: 0,
                schemaChanged: 0,
            };
            this.forceUpdate();
        };
    }
    shouldComponentUpdate(prevProps) {
        var _a, _b;
        const { data, options } = this.props;
        if (prevProps.data !== data) {
            this.counters.dataChanged++;
            if ((_a = options.counters) === null || _a === void 0 ? void 0 : _a.schemaChanged) {
                const oldSeries = (_b = prevProps.data) === null || _b === void 0 ? void 0 : _b.series;
                const series = data.series;
                if (series && oldSeries) {
                    const sameStructure = compareArrayValues(series, oldSeries, compareDataFrameStructures);
                    if (!sameStructure) {
                        this.counters.schemaChanged++;
                    }
                }
            }
        }
        return true; // always render?
    }
    render() {
        var _a;
        const { data, options } = this.props;
        const showCounters = (_a = options.counters) !== null && _a !== void 0 ? _a : {
            render: false,
            dataChanged: false,
            schemaChanged: false,
        };
        this.counters.render++;
        const now = Date.now();
        const elapsed = now - this.lastRender;
        this.lastRender = now;
        const reducer = fieldReducers.get(ReducerID.lastNotNull);
        return (React.createElement("div", null,
            React.createElement("div", null,
                React.createElement(IconButton, { name: "step-backward", title: "reset counters", onClick: this.resetCounters, tooltip: "Step back" }),
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
                data.series.map((frame, idx) => (React.createElement("div", { key: `${idx}/${frame.refId}` },
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
                        React.createElement("tbody", null, frame.fields.map((field, idx) => {
                            const v = reducer.reduce(field, false, false)[reducer.id];
                            return (React.createElement("tr", { key: `${idx}/${field.name}` },
                                React.createElement("td", null, getFieldDisplayName(field, frame, data.series)),
                                React.createElement("td", null, field.type),
                                React.createElement("td", null, `${v}`)));
                        }))))))));
    }
}
//# sourceMappingURL=RenderInfoViewer.js.map