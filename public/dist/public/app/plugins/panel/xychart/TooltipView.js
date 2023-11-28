import { css } from '@emotion/css';
import React from 'react';
import { formattedValueToString, getFieldDisplayName } from '@grafana/data';
import { LinkButton, useStyles2, VerticalGroup } from '@grafana/ui';
import { findField } from 'app/features/dimensions';
import { getTitleFromHref } from 'app/features/explore/utils/links';
import { SeriesMapping } from './panelcfg.gen';
export const TooltipView = ({ allSeries, data, manualSeriesConfigs, seriesMapping, rowIndex, hoveredPointIndex, options, }) => {
    var _a, _b, _c, _d, _e, _f;
    const style = useStyles2(getStyles);
    if (!allSeries || rowIndex == null) {
        return null;
    }
    const series = allSeries[hoveredPointIndex];
    const frame = series.frame(data);
    const xField = series.x(frame);
    const yField = series.y(frame);
    let links = undefined;
    if (yField.getLinks) {
        const v = yField.values[rowIndex];
        const disp = yField.display ? yField.display(v) : { text: `${v}`, numeric: +v };
        links = yField.getLinks({ calculatedValue: disp, valueRowIndex: rowIndex }).map((linkModel) => {
            if (!linkModel.title) {
                linkModel.title = getTitleFromHref(linkModel.href);
            }
            return linkModel;
        });
    }
    let extraFields = frame.fields.filter((f) => f !== xField && f !== yField);
    let yValue = null;
    let extraFacets = null;
    if (seriesMapping === SeriesMapping.Manual && manualSeriesConfigs) {
        const colorFacetFieldName = (_c = (_b = (_a = manualSeriesConfigs[hoveredPointIndex]) === null || _a === void 0 ? void 0 : _a.pointColor) === null || _b === void 0 ? void 0 : _b.field) !== null && _c !== void 0 ? _c : '';
        const sizeFacetFieldName = (_f = (_e = (_d = manualSeriesConfigs[hoveredPointIndex]) === null || _d === void 0 ? void 0 : _d.pointSize) === null || _e === void 0 ? void 0 : _e.field) !== null && _f !== void 0 ? _f : '';
        const colorFacet = colorFacetFieldName ? findField(frame, colorFacetFieldName) : undefined;
        const sizeFacet = sizeFacetFieldName ? findField(frame, sizeFacetFieldName) : undefined;
        extraFacets = {
            colorFacetFieldName,
            sizeFacetFieldName,
            colorFacetValue: colorFacet === null || colorFacet === void 0 ? void 0 : colorFacet.values[rowIndex],
            sizeFacetValue: sizeFacet === null || sizeFacet === void 0 ? void 0 : sizeFacet.values[rowIndex],
        };
        extraFields = extraFields.filter((f) => f !== colorFacet && f !== sizeFacet);
    }
    yValue = {
        name: getFieldDisplayName(yField, frame),
        val: yField.values[rowIndex],
        field: yField,
        color: series.pointColor(frame),
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("table", { className: style.infoWrap },
            React.createElement("tr", null,
                React.createElement("th", { colSpan: 2, style: { backgroundColor: yValue.color } })),
            React.createElement("tbody", null,
                React.createElement("tr", null,
                    React.createElement("th", null, getFieldDisplayName(xField, frame)),
                    React.createElement("td", null, fmt(xField, xField.values[rowIndex]))),
                React.createElement("tr", null,
                    React.createElement("th", null,
                        yValue.name,
                        ":"),
                    React.createElement("td", null, fmt(yValue.field, yValue.val))),
                extraFacets !== null && extraFacets.colorFacetFieldName && (React.createElement("tr", null,
                    React.createElement("th", null,
                        extraFacets.colorFacetFieldName,
                        ":"),
                    React.createElement("td", null, extraFacets.colorFacetValue))),
                extraFacets !== null && extraFacets.sizeFacetFieldName && (React.createElement("tr", null,
                    React.createElement("th", null,
                        extraFacets.sizeFacetFieldName,
                        ":"),
                    React.createElement("td", null, extraFacets.sizeFacetValue))),
                extraFields.map((field, i) => (React.createElement("tr", { key: i },
                    React.createElement("th", null,
                        getFieldDisplayName(field, frame),
                        ":"),
                    React.createElement("td", null, fmt(field, field.values[rowIndex]))))),
                links && links.length > 0 && (React.createElement("tr", null,
                    React.createElement("td", { colSpan: 2 },
                        React.createElement(VerticalGroup, null, links.map((link, i) => (React.createElement(LinkButton, { key: i, icon: 'external-link-alt', target: link.target, href: link.href, onClick: link.onClick, fill: "text", style: { width: '100%' } }, link.title)))))))))));
};
function fmt(field, val) {
    if (field.display) {
        return formattedValueToString(field.display(val));
    }
    return `${val}`;
}
const getStyles = (theme) => ({
    infoWrap: css `
    padding: 8px;
    width: 100%;
    th {
      font-weight: ${theme.typography.fontWeightMedium};
      padding: ${theme.spacing(0.25, 2)};
    }
  `,
    highlight: css `
    background: ${theme.colors.action.hover};
  `,
    xVal: css `
    font-weight: ${theme.typography.fontWeightBold};
  `,
    icon: css `
    margin-right: ${theme.spacing(1)};
    vertical-align: middle;
  `,
});
//# sourceMappingURL=TooltipView.js.map