import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { cx, css } from '@emotion/css';
import { InlineFormLabel, LinkButton, Segment, CodeEditor, CodeEditorSuggestionItemKind, } from '@grafana/ui';
import { getTemplateSrv } from '@grafana/runtime';
var samples = [
    { label: 'Show buckets', description: 'List the available buckets (table)', value: 'buckets()' },
    {
        label: 'Simple query',
        description: 'filter by measurement and field',
        value: "from(bucket: \"db/rp\")\n  |> range(start: v.timeRangeStart, stop:v.timeRangeStop)\n  |> filter(fn: (r) =>\n    r._measurement == \"example-measurement\" and\n    r._field == \"example-field\"\n  )",
    },
    {
        label: 'Grouped Query',
        description: 'Group by (min/max/sum/median)',
        value: "// v.windowPeriod is a variable referring to the current optimized window period (currently: $interval)\nfrom(bucket: v.bucket)\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\n  |> filter(fn: (r) => r[\"_measurement\"] == \"measurement1\" or r[\"_measurement\"] =~ /^.*?regex.*$/)\n  |> filter(fn: (r) => r[\"_field\"] == \"field2\" or r[\"_field\"] =~ /^.*?regex.*$/)\n  |> aggregateWindow(every: v.windowPeriod, fn: mean|median|max|count|derivative|sum)\n  |> yield(name: \"some-name\")",
    },
    {
        label: 'Filter by value',
        description: 'Results between a min/max',
        value: "// v.bucket, v.timeRangeStart, and v.timeRange stop are all variables supported by the flux plugin and influxdb\nfrom(bucket: v.bucket)\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\n  |> filter(fn: (r) => r[\"_value\"] >= 10 and r[\"_value\"] <= 20)",
    },
    {
        label: 'Schema Exploration: (measurements)',
        description: 'Get a list of measurement using flux',
        value: "import \"influxdata/influxdb/v1\"\nv1.measurements(bucket: v.bucket)",
    },
    {
        label: 'Schema Exploration: (fields)',
        description: 'Return every possible key in a single table',
        value: "from(bucket: v.bucket)\n  |> range(start: v.timeRangeStart, stop:v.timeRangeStop)\n  |> keys()\n  |> keep(columns: [\"_value\"])\n  |> group()\n  |> distinct()",
    },
    {
        label: 'Schema Exploration: (tag keys)',
        description: 'Get a list of tag keys using flux',
        value: "import \"influxdata/influxdb/v1\"\nv1.tagKeys(bucket: v.bucket)",
    },
    {
        label: 'Schema Exploration: (tag values)',
        description: 'Get a list of tag values using flux',
        value: "import \"influxdata/influxdb/v1\"\nv1.tagValues(\n    bucket: v.bucket,\n    tag: \"host\",\n    predicate: (r) => true,\n    start: -1d\n)",
    },
];
var FluxQueryEditor = /** @class */ (function (_super) {
    __extends(FluxQueryEditor, _super);
    function FluxQueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onFluxQueryChange = function (query) {
            _this.props.onChange(__assign(__assign({}, _this.props.query), { query: query }));
            _this.props.onRunQuery();
        };
        _this.onSampleChange = function (val) {
            _this.props.onChange(__assign(__assign({}, _this.props.query), { query: val.value }));
            // Angular HACK: Since the target does not actually change!
            _this.forceUpdate();
            _this.props.onRunQuery();
        };
        _this.getSuggestions = function () {
            var sugs = [
                {
                    label: 'v.timeRangeStart',
                    kind: CodeEditorSuggestionItemKind.Property,
                    detail: 'The start time',
                },
                {
                    label: 'v.timeRangeStop',
                    kind: CodeEditorSuggestionItemKind.Property,
                    detail: 'The stop time',
                },
                {
                    label: 'v.windowPeriod',
                    kind: CodeEditorSuggestionItemKind.Property,
                    detail: 'based on max data points',
                },
                {
                    label: 'v.defaultBucket',
                    kind: CodeEditorSuggestionItemKind.Property,
                    detail: 'bucket configured in the datsource',
                },
                {
                    label: 'v.organization',
                    kind: CodeEditorSuggestionItemKind.Property,
                    detail: 'org configured for the datsource',
                },
            ];
            var templateSrv = getTemplateSrv();
            templateSrv.getVariables().forEach(function (variable) {
                var label = '${' + variable.name + '}';
                var val = templateSrv.replace(label);
                if (val === label) {
                    val = '';
                }
                sugs.push({
                    label: label,
                    kind: CodeEditorSuggestionItemKind.Text,
                    detail: "(Template Variable) " + val,
                });
            });
            return sugs;
        };
        // For some reason in angular, when this component gets re-mounted, the width
        // is not set properly.  This forces the layout shortly after mount so that it
        // displays OK.  Note: this is not an issue when used directly in react
        _this.editorDidMountCallbackHack = function (editor) {
            setTimeout(function () { return editor.layout(); }, 100);
        };
        return _this;
    }
    FluxQueryEditor.prototype.render = function () {
        var query = this.props.query;
        var helpTooltip = (React.createElement("div", null,
            "Type: ",
            React.createElement("i", null, "ctrl+space"),
            " to show template variable suggestions ",
            React.createElement("br", null),
            "Many queries can be copied from Chronograf"));
        return (React.createElement(React.Fragment, null,
            React.createElement(CodeEditor, { height: '200px', language: "sql", value: query.query || '', onBlur: this.onFluxQueryChange, onSave: this.onFluxQueryChange, showMiniMap: false, showLineNumbers: true, getSuggestions: this.getSuggestions, onEditorDidMount: this.editorDidMountCallbackHack }),
            React.createElement("div", { className: cx('gf-form-inline', css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n              margin-top: 6px;\n            "], ["\n              margin-top: 6px;\n            "])))) },
                React.createElement(LinkButton, { icon: "external-link-alt", variant: "secondary", target: "blank", href: "https://docs.influxdata.com/influxdb/latest/query-data/get-started/" }, "Flux language syntax"),
                React.createElement(Segment, { options: samples, value: "Sample Query", onChange: this.onSampleChange }),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" })),
                React.createElement(InlineFormLabel, { width: 5, tooltip: helpTooltip }, "Help"))));
    };
    return FluxQueryEditor;
}(PureComponent));
export { FluxQueryEditor };
var templateObject_1;
//# sourceMappingURL=FluxQueryEditor.js.map