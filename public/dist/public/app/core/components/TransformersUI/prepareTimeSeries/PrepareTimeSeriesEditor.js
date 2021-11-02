import { __assign, __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { prepareTimeSeriesTransformer, timeSeriesFormat } from './prepareTimeSeries';
import { InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
var wideInfo = {
    label: 'Wide time series',
    value: timeSeriesFormat.TimeSeriesWide,
    description: 'Creates a single frame joined by time',
    info: (React.createElement("ul", null,
        React.createElement("li", null, "Single frame"),
        React.createElement("li", null, "1st field is shared time field"),
        React.createElement("li", null, "Time in ascending order"),
        React.createElement("li", null, "Multiple value fields of any type"))),
};
var manyInfo = {
    label: 'Multi-frame time series',
    value: timeSeriesFormat.TimeSeriesMany,
    description: 'Creates a new frame for each time/number pair',
    info: (React.createElement("ul", null,
        React.createElement("li", null, "Multiple frames"),
        React.createElement("li", null, "Each frame has two fields: time, value"),
        React.createElement("li", null, "Time in ascending order"),
        React.createElement("li", null, "String values are represented as labels"),
        React.createElement("li", null, "All values are numeric"))),
};
var longInfo = {
    label: 'Long time series',
    value: timeSeriesFormat.TimeSeriesLong,
    description: 'Convert each frame to long format',
    info: (React.createElement("ul", null,
        React.createElement("li", null, "Single frame"),
        React.createElement("li", null, "1st field is time field"),
        React.createElement("li", null, "Time in ascending order, but may have duplictes"),
        React.createElement("li", null, "String values are represented as separate fields rather than as labels"),
        React.createElement("li", null, "Multiple value fields may exist"))),
};
var formats = [wideInfo, manyInfo, longInfo];
export function PrepareTimeSeriesEditor(props) {
    var options = props.options, onChange = props.onChange;
    var styles = useStyles2(getStyles);
    var onSelectFormat = useCallback(function (value) {
        onChange(__assign(__assign({}, options), { format: value.value }));
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Format", labelWidth: 12 },
                React.createElement(Select, { menuShouldPortal: true, width: 35, options: formats, value: formats.find(function (v) { return v.value === options.format; }) || formats[0], onChange: onSelectFormat, className: "flex-grow-1" }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Info", labelWidth: 12 },
                React.createElement("div", { className: styles.info }, (formats.find(function (v) { return v.value === options.format; }) || formats[0]).info)))));
}
var getStyles = function (theme) { return ({
    info: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-left: 20px;\n  "], ["\n    margin-left: 20px;\n  "]))),
}); };
export var prepareTimeseriesTransformerRegistryItem = {
    id: prepareTimeSeriesTransformer.id,
    editor: PrepareTimeSeriesEditor,
    transformation: prepareTimeSeriesTransformer,
    name: prepareTimeSeriesTransformer.name,
    description: prepareTimeSeriesTransformer.description,
    help: "\n  ### Use cases\n\n  This takes query results and transforms them into a predictable timeseries format.\n  This transformer may be especially useful when using old panels that only expect the\n  many-frame timeseries format.\n  ",
};
var templateObject_1;
//# sourceMappingURL=PrepareTimeSeriesEditor.js.map