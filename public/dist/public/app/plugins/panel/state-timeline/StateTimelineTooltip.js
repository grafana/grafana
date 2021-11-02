import React from 'react';
import { FALLBACK_COLOR, formattedValueToString, getDisplayProcessor, getFieldDisplayName, getValueFormat, } from '@grafana/data';
import { SeriesTableRow, useTheme2 } from '@grafana/ui';
import { findNextStateIndex } from './utils';
export var StateTimelineTooltip = function (_a) {
    var _b;
    var data = _a.data, alignedData = _a.alignedData, seriesIdx = _a.seriesIdx, datapointIdx = _a.datapointIdx, timeZone = _a.timeZone;
    var theme = useTheme2();
    var xField = alignedData.fields[0];
    var xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone: timeZone, theme: theme });
    var field = alignedData.fields[seriesIdx];
    var dataFrameFieldIndex = (_b = field.state) === null || _b === void 0 ? void 0 : _b.origin;
    var fieldFmt = field.display || getDisplayProcessor({ field: field, timeZone: timeZone, theme: theme });
    var value = field.values.get(datapointIdx);
    var display = fieldFmt(value);
    var fieldDisplayName = dataFrameFieldIndex
        ? getFieldDisplayName(data[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex], data[dataFrameFieldIndex.frameIndex], data)
        : null;
    var nextStateIdx = findNextStateIndex(field, datapointIdx);
    var nextStateTs;
    if (nextStateIdx) {
        nextStateTs = xField.values.get(nextStateIdx);
    }
    var stateTs = xField.values.get(datapointIdx);
    var toFragment = null;
    var durationFragment = null;
    if (nextStateTs) {
        var duration = nextStateTs && formattedValueToString(getValueFormat('dtdurationms')(nextStateTs - stateTs, 0));
        durationFragment = (React.createElement(React.Fragment, null,
            React.createElement("br", null),
            React.createElement("strong", null, "Duration:"),
            " ",
            duration));
        toFragment = (React.createElement(React.Fragment, null,
            ' to',
            " ",
            React.createElement("strong", null, xFieldFmt(xField.values.get(nextStateIdx)).text)));
    }
    return (React.createElement("div", { style: { fontSize: theme.typography.bodySmall.fontSize } },
        fieldDisplayName,
        React.createElement("br", null),
        React.createElement(SeriesTableRow, { label: display.text, color: display.color || FALLBACK_COLOR, isActive: true }),
        "From ",
        React.createElement("strong", null, xFieldFmt(xField.values.get(datapointIdx)).text),
        toFragment,
        durationFragment));
};
StateTimelineTooltip.displayName = 'StateTimelineTooltip';
//# sourceMappingURL=StateTimelineTooltip.js.map