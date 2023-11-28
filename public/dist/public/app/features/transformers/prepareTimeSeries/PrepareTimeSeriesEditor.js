import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { TransformerCategory, } from '@grafana/data';
import { InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { prepareTimeSeriesTransformer, timeSeriesFormat } from './prepareTimeSeries';
const wideInfo = {
    label: 'Wide time series',
    value: timeSeriesFormat.TimeSeriesWide,
    description: 'Creates a single frame joined by time',
    info: (React.createElement("ul", null,
        React.createElement("li", null, "Single frame"),
        React.createElement("li", null, "1st field is shared time field"),
        React.createElement("li", null, "Time in ascending order"),
        React.createElement("li", null, "Multiple value fields of any type"))),
};
const multiInfo = {
    label: 'Multi-frame time series',
    value: timeSeriesFormat.TimeSeriesMulti,
    description: 'Creates a new frame for each time/number pair',
    info: (React.createElement("ul", null,
        React.createElement("li", null, "Multiple frames"),
        React.createElement("li", null, "Each frame has two fields: time, value"),
        React.createElement("li", null, "Time in ascending order"),
        React.createElement("li", null, "String values are represented as labels"),
        React.createElement("li", null, "All values are numeric"))),
};
const longInfo = {
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
const formats = [wideInfo, multiInfo, longInfo];
export function PrepareTimeSeriesEditor(props) {
    const { options, onChange } = props;
    const styles = useStyles2(getStyles);
    const onSelectFormat = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { format: value.value }));
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Format", labelWidth: 12 },
                React.createElement(Select, { width: 35, options: formats, value: formats.find((v) => {
                        // migrate previously selected timeSeriesMany to multi
                        if (v.value === timeSeriesFormat.TimeSeriesMulti &&
                            options.format === timeSeriesFormat.TimeSeriesMany) {
                            return true;
                        }
                        else {
                            return v.value === options.format;
                        }
                    }) || formats[0], onChange: onSelectFormat, className: "flex-grow-1" }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Info", labelWidth: 12 },
                React.createElement("div", { className: styles.info }, (formats.find((v) => v.value === options.format) || formats[0]).info)))));
}
const getStyles = (theme) => ({
    info: css `
    margin-left: 20px;
  `,
});
export const prepareTimeseriesTransformerRegistryItem = {
    id: prepareTimeSeriesTransformer.id,
    editor: PrepareTimeSeriesEditor,
    transformation: prepareTimeSeriesTransformer,
    name: prepareTimeSeriesTransformer.name,
    description: prepareTimeSeriesTransformer.description,
    help: `
  ### Use cases

  This takes query results and transforms them into a predictable timeseries format.
  This transformer may be especially useful when using old panels that only expect the
  many-frame timeseries format.
  `,
    categories: new Set([TransformerCategory.Reformat]),
};
//# sourceMappingURL=PrepareTimeSeriesEditor.js.map