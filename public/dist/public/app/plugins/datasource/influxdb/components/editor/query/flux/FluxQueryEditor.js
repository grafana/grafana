import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { getTemplateSrv } from '@grafana/runtime/src';
import { CodeEditor, CodeEditorSuggestionItemKind, InlineFormLabel, LinkButton, Segment, withTheme2, } from '@grafana/ui/src';
const samples = [
    { label: 'Show buckets', description: 'List the available buckets (table)', value: 'buckets()' },
    {
        label: 'Simple query',
        description: 'filter by measurement and field',
        value: `from(bucket: "db/rp")
  |> range(start: v.timeRangeStart, stop:v.timeRangeStop)
  |> filter(fn: (r) =>
    r._measurement == "example-measurement" and
    r._field == "example-field"
  )`,
    },
    {
        label: 'Grouped Query',
        description: 'Group by (min/max/sum/median)',
        value: `// v.windowPeriod is a variable referring to the current optimized window period (currently: $interval)
from(bucket: v.bucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "measurement1" or r["_measurement"] =~ /^.*?regex.*$/)
  |> filter(fn: (r) => r["_field"] == "field2" or r["_field"] =~ /^.*?regex.*$/)
  |> aggregateWindow(every: v.windowPeriod, fn: mean|median|max|count|derivative|sum)
  |> yield(name: "some-name")`,
    },
    {
        label: 'Filter by value',
        description: 'Results between a min/max',
        value: `// v.bucket, v.timeRangeStart, and v.timeRange stop are all variables supported by the flux plugin and influxdb
from(bucket: v.bucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_value"] >= 10 and r["_value"] <= 20)`,
    },
    {
        label: 'Schema Exploration: (measurements)',
        description: 'Get a list of measurement using flux',
        value: `import "influxdata/influxdb/v1"
v1.measurements(bucket: v.bucket)`,
    },
    {
        label: 'Schema Exploration: (fields)',
        description: 'Return every possible key in a single table',
        value: `from(bucket: v.bucket)
  |> range(start: v.timeRangeStart, stop:v.timeRangeStop)
  |> keys()
  |> keep(columns: ["_value"])
  |> group()
  |> distinct()`,
    },
    {
        label: 'Schema Exploration: (tag keys)',
        description: 'Get a list of tag keys using flux',
        value: `import "influxdata/influxdb/v1"
v1.tagKeys(bucket: v.bucket)`,
    },
    {
        label: 'Schema Exploration: (tag values)',
        description: 'Get a list of tag values using flux',
        value: `import "influxdata/influxdb/v1"
v1.tagValues(
    bucket: v.bucket,
    tag: "host",
    predicate: (r) => true,
    start: -1d
)`,
    },
];
class UnthemedFluxQueryEditor extends PureComponent {
    constructor() {
        super(...arguments);
        this.onFluxQueryChange = (query) => {
            this.props.onChange(Object.assign(Object.assign({}, this.props.query), { query }));
            this.props.onRunQuery();
        };
        this.onSampleChange = (val) => {
            this.props.onChange(Object.assign(Object.assign({}, this.props.query), { query: val.value }));
            // Angular HACK: Since the target does not actually change!
            this.forceUpdate();
            this.props.onRunQuery();
        };
        this.getSuggestions = () => {
            const sugs = [
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
            const templateSrv = getTemplateSrv();
            templateSrv.getVariables().forEach((variable) => {
                const label = '${' + variable.name + '}';
                let val = templateSrv.replace(label);
                if (val === label) {
                    val = '';
                }
                sugs.push({
                    label,
                    kind: CodeEditorSuggestionItemKind.Text,
                    detail: `(Template Variable) ${val}`,
                });
            });
            return sugs;
        };
        // For some reason in angular, when this component gets re-mounted, the width
        // is not set properly.  This forces the layout shortly after mount so that it
        // displays OK.  Note: this is not an issue when used directly in react
        this.editorDidMountCallbackHack = (editor) => {
            setTimeout(() => editor.layout(), 100);
        };
    }
    render() {
        const { query, theme } = this.props;
        const styles = getStyles(theme);
        const helpTooltip = (React.createElement("div", null,
            "Type: ",
            React.createElement("i", null, "ctrl+space"),
            " to show template variable suggestions ",
            React.createElement("br", null),
            "Many queries can be copied from Chronograf"));
        return (React.createElement(React.Fragment, null,
            React.createElement(CodeEditor, { height: '100%', containerStyles: styles.editorContainerStyles, language: "sql", value: query.query || '', onBlur: this.onFluxQueryChange, onSave: this.onFluxQueryChange, showMiniMap: false, showLineNumbers: true, getSuggestions: this.getSuggestions, onEditorDidMount: this.editorDidMountCallbackHack }),
            React.createElement("div", { className: cx('gf-form-inline', styles.editorActions) },
                React.createElement(LinkButton, { icon: "external-link-alt", variant: "secondary", target: "blank", href: "https://docs.influxdata.com/influxdb/latest/query-data/get-started/" }, "Flux language syntax"),
                React.createElement(Segment, { options: samples, value: "Sample query", onChange: this.onSampleChange, className: css `
              margin-top: -${theme.spacing(0.5)};
              margin-left: ${theme.spacing(0.5)};
            ` }),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" })),
                React.createElement(InlineFormLabel, { width: 5, tooltip: helpTooltip }, "Help"))));
    }
}
const getStyles = (theme) => ({
    editorContainerStyles: css `
    height: 200px;
    max-width: 100%;
    resize: vertical;
    overflow: auto;
    background-color: ${theme.isDark ? theme.colors.background.canvas : theme.colors.background.primary};
    padding-bottom: ${theme.spacing(1)};
  `,
    editorActions: css `
    margin-top: 6px;
  `,
});
export const FluxQueryEditor = withTheme2(UnthemedFluxQueryEditor);
//# sourceMappingURL=FluxQueryEditor.js.map