import { __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { arrayUtils, formattedValueToString, getFieldDisplayName, } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { TextLink, useStyles2 } from '@grafana/ui';
import { renderValue } from 'app/plugins/panel/geomap/utils/uiUtils';
export const DataHoverView = ({ data, rowIndex, columnIndex, sortOrder, mode, header = undefined }) => {
    const styles = useStyles2(getStyles);
    if (!data || rowIndex == null) {
        return null;
    }
    const fields = data.fields.map((f, idx) => {
        return Object.assign(Object.assign({}, f), { hovered: idx === columnIndex });
    });
    const visibleFields = fields.filter((f) => { var _a, _b; return !Boolean((_b = (_a = f.config.custom) === null || _a === void 0 ? void 0 : _a.hideFrom) === null || _b === void 0 ? void 0 : _b.tooltip); });
    const traceIDField = visibleFields.find((field) => field.name === 'traceID') || fields[0];
    const orderedVisibleFields = [];
    // Only include traceID if it's visible and put it in front.
    if (visibleFields.filter((field) => traceIDField === field).length > 0) {
        orderedVisibleFields.push(traceIDField);
    }
    orderedVisibleFields.push(...visibleFields.filter((field) => traceIDField !== field));
    if (orderedVisibleFields.length === 0) {
        return null;
    }
    const displayValues = [];
    const links = [];
    const linkLookup = new Set();
    for (const field of orderedVisibleFields) {
        if (mode === TooltipDisplayMode.Single && columnIndex != null && !field.hovered) {
            continue;
        }
        const value = field.values[rowIndex];
        const fieldDisplay = field.display ? field.display(value) : { text: `${value}`, numeric: +value };
        if (field.getLinks) {
            field.getLinks({ calculatedValue: fieldDisplay, valueRowIndex: rowIndex }).forEach((link) => {
                const key = `${link.title}/${link.href}`;
                if (!linkLookup.has(key)) {
                    links.push(link);
                    linkLookup.add(key);
                }
            });
        }
        // Sanitize field by removing hovered property to fix unique display name issue
        const { hovered } = field, sanitizedField = __rest(field, ["hovered"]);
        displayValues.push({
            name: getFieldDisplayName(sanitizedField, data),
            value,
            valueString: formattedValueToString(fieldDisplay),
            highlight: field.hovered,
        });
    }
    if (sortOrder && sortOrder !== SortOrder.None) {
        displayValues.sort((a, b) => arrayUtils.sortValues(sortOrder)(a.value, b.value));
    }
    return (React.createElement("div", { className: styles.wrapper },
        header && (React.createElement("div", { className: styles.header },
            React.createElement("span", { className: styles.title }, header))),
        React.createElement("table", { className: styles.infoWrap },
            React.createElement("tbody", null,
                displayValues.map((displayValue, i) => (React.createElement("tr", { key: `${i}/${rowIndex}` },
                    React.createElement("th", null, displayValue.name),
                    React.createElement("td", null, renderValue(displayValue.valueString))))),
                links.map((link, i) => (React.createElement("tr", { key: i },
                    React.createElement("th", null, "Link"),
                    React.createElement("td", { colSpan: 2 },
                        React.createElement(TextLink, { href: link.href, external: link.target === '_blank', weight: 'medium', inline: false }, link.title)))))))));
};
const getStyles = (theme) => {
    return {
        wrapper: css `
      background: ${theme.components.tooltip.background};
      border-radius: ${theme.shape.borderRadius(2)};
    `,
        header: css `
      background: ${theme.colors.background.secondary};
      align-items: center;
      align-content: center;
      display: flex;
      padding-bottom: ${theme.spacing(1)};
    `,
        title: css `
      font-weight: ${theme.typography.fontWeightMedium};
      overflow: hidden;
      display: inline-block;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex-grow: 1;
    `,
        infoWrap: css `
      padding: ${theme.spacing(1)};
      background: transparent;
      border: none;
      th {
        font-weight: ${theme.typography.fontWeightMedium};
        padding: ${theme.spacing(0.25, 2, 0.25, 0)};
      }

      tr {
        border-bottom: 1px solid ${theme.colors.border.weak};
        &:last-child {
          border-bottom: none;
        }
      }
    `,
        highlight: css ``,
        link: css `
      color: ${theme.colors.text.link};
    `,
    };
};
//# sourceMappingURL=DataHoverView.js.map