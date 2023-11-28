import React from 'react';
import { FALLBACK_COLOR, getDisplayProcessor, getFieldDisplayName, } from '@grafana/data';
import { MenuItem, SeriesTableRow, useTheme2 } from '@grafana/ui';
export const StatusHistoryTooltip = ({ data, alignedData, seriesIdx, datapointIdx, timeZone, }) => {
    var _a;
    const theme = useTheme2();
    if (!data || datapointIdx == null) {
        return null;
    }
    const field = alignedData.fields[seriesIdx];
    const links = [];
    const linkLookup = new Set();
    if (field.getLinks) {
        const v = field.values[datapointIdx];
        const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };
        field.getLinks({ calculatedValue: disp, valueRowIndex: datapointIdx }).forEach((link) => {
            const key = `${link.title}/${link.href}`;
            if (!linkLookup.has(key)) {
                links.push(link);
                linkLookup.add(key);
            }
        });
    }
    const xField = alignedData.fields[0];
    const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });
    const dataFrameFieldIndex = (_a = field.state) === null || _a === void 0 ? void 0 : _a.origin;
    const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
    const value = field.values[datapointIdx];
    const display = fieldFmt(value);
    const fieldDisplayName = dataFrameFieldIndex
        ? getFieldDisplayName(data[dataFrameFieldIndex.frameIndex].fields[dataFrameFieldIndex.fieldIndex], data[dataFrameFieldIndex.frameIndex], data)
        : null;
    return (React.createElement("div", null,
        React.createElement("div", { style: { fontSize: theme.typography.bodySmall.fontSize } },
            React.createElement("strong", null, xFieldFmt(xField.values[datapointIdx]).text),
            React.createElement("br", null),
            React.createElement(SeriesTableRow, { label: display.text, color: display.color || FALLBACK_COLOR, isActive: true }),
            fieldDisplayName),
        links.length > 0 && (React.createElement("div", { style: {
                margin: theme.spacing(1, -1, -1, -1),
                borderTop: `1px solid ${theme.colors.border.weak}`,
            } }, links.map((link, i) => (React.createElement(MenuItem, { key: i, icon: 'external-link-alt', target: link.target, label: link.title, url: link.href, onClick: link.onClick })))))));
};
StatusHistoryTooltip.displayName = 'StatusHistoryTooltip';
//# sourceMappingURL=StatusHistoryTooltip.js.map