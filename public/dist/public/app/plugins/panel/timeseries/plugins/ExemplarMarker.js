import { __assign, __makeTemplateObject, __read } from "tslib";
import { css, cx } from '@emotion/css';
import { dateTimeFormat, FieldType, systemDateFormats, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FieldLinkList, Portal, useStyles } from '@grafana/ui';
import React, { useCallback, useRef, useState } from 'react';
import { usePopper } from 'react-popper';
export var ExemplarMarker = function (_a) {
    var _b;
    var timeZone = _a.timeZone, dataFrame = _a.dataFrame, dataFrameFieldIndex = _a.dataFrameFieldIndex, config = _a.config, getFieldLinks = _a.getFieldLinks;
    var styles = useStyles(getExemplarMarkerStyles);
    var _c = __read(useState(false), 2), isOpen = _c[0], setIsOpen = _c[1];
    var _d = __read(React.useState(null), 2), markerElement = _d[0], setMarkerElement = _d[1];
    var _e = __read(React.useState(null), 2), popperElement = _e[0], setPopperElement = _e[1];
    var _f = usePopper(markerElement, popperElement), popperStyles = _f.styles, attributes = _f.attributes;
    var popoverRenderTimeout = useRef();
    var getSymbol = function () {
        var symbols = [
            React.createElement("rect", { key: "diamond", x: "3.38672", width: "4.78985", height: "4.78985", transform: "rotate(45 3.38672 0)" }),
            React.createElement("path", { key: "x", d: "M1.94444 3.49988L0 5.44432L1.55552 6.99984L3.49996 5.05539L5.4444 6.99983L6.99992 5.44431L5.05548 3.49988L6.99983 1.55552L5.44431 0L3.49996 1.94436L1.5556 0L8.42584e-05 1.55552L1.94444 3.49988Z" }),
            React.createElement("path", { key: "triangle", d: "M4 0L7.4641 6H0.535898L4 0Z" }),
            React.createElement("rect", { key: "rectangle", width: "5", height: "5" }),
            React.createElement("path", { key: "pentagon", d: "M3 0.5L5.85317 2.57295L4.76336 5.92705H1.23664L0.146831 2.57295L3 0.5Z" }),
            React.createElement("path", { key: "plus", d: "m2.35672,4.2425l0,2.357l1.88558,0l0,-2.357l2.3572,0l0,-1.88558l-2.3572,0l0,-2.35692l-1.88558,0l0,2.35692l-2.35672,0l0,1.88558l2.35672,0z" }),
        ];
        return symbols[dataFrameFieldIndex.frameIndex % symbols.length];
    };
    var onMouseEnter = useCallback(function () {
        if (popoverRenderTimeout.current) {
            clearTimeout(popoverRenderTimeout.current);
        }
        setIsOpen(true);
    }, [setIsOpen]);
    var onMouseLeave = useCallback(function () {
        popoverRenderTimeout.current = setTimeout(function () {
            setIsOpen(false);
        }, 100);
    }, [setIsOpen]);
    var renderMarker = useCallback(function () {
        var timeFormatter = function (value) {
            return dateTimeFormat(value, {
                format: systemDateFormats.fullDate,
                timeZone: timeZone,
            });
        };
        return (React.createElement("div", __assign({ onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, className: styles.tooltip, ref: setPopperElement, style: popperStyles.popper }, attributes.popper),
            React.createElement("div", { className: styles.wrapper },
                React.createElement("div", { className: styles.header },
                    React.createElement("span", { className: styles.title }, "Exemplar")),
                React.createElement("div", { className: styles.body },
                    React.createElement("div", null,
                        React.createElement("table", { className: styles.exemplarsTable },
                            React.createElement("tbody", null, dataFrame.fields.map(function (field, i) {
                                var _a;
                                var value = field.values.get(dataFrameFieldIndex.fieldIndex);
                                var links = ((_a = field.config.links) === null || _a === void 0 ? void 0 : _a.length)
                                    ? getFieldLinks(field, dataFrameFieldIndex.fieldIndex)
                                    : undefined;
                                return (React.createElement("tr", { key: i },
                                    React.createElement("td", { valign: "top" }, field.name),
                                    React.createElement("td", null,
                                        React.createElement("div", { className: styles.valueWrapper },
                                            React.createElement("span", null, field.type === FieldType.time ? timeFormatter(value) : value),
                                            links && React.createElement(FieldLinkList, { links: links })))));
                            }))))))));
    }, [
        attributes.popper,
        dataFrame.fields,
        getFieldLinks,
        dataFrameFieldIndex,
        onMouseEnter,
        onMouseLeave,
        popperStyles.popper,
        styles,
        timeZone,
    ]);
    var seriesColor = (_b = config
        .getSeries()
        .find(function (s) { var _a; return ((_a = s.props.dataFrameFieldIndex) === null || _a === void 0 ? void 0 : _a.frameIndex) === dataFrameFieldIndex.frameIndex; })) === null || _b === void 0 ? void 0 : _b.props.lineColor;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { ref: setMarkerElement, onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, className: styles.markerWrapper, "aria-label": selectors.components.DataSource.Prometheus.exemplarMarker },
            React.createElement("svg", { viewBox: "0 0 7 7", width: "7", height: "7", style: { fill: seriesColor }, className: cx(styles.marble, isOpen && styles.activeMarble) }, getSymbol())),
        isOpen && React.createElement(Portal, null, renderMarker())));
};
var getExemplarMarkerStyles = function (theme) {
    var bg = theme.isDark ? theme.palette.dark2 : theme.palette.white;
    var headerBg = theme.isDark ? theme.palette.dark9 : theme.palette.gray5;
    var shadowColor = theme.isDark ? theme.palette.black : theme.palette.white;
    var tableBgOdd = theme.isDark ? theme.palette.dark3 : theme.palette.gray6;
    return {
        markerWrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: 0 4px 4px 4px;\n      width: 8px;\n      height: 8px;\n      box-sizing: content-box;\n      transform: translate3d(-50%, 0, 0);\n\n      &:hover {\n        > svg {\n          transform: scale(1.3);\n          opacity: 1;\n          filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));\n        }\n      }\n    "], ["\n      padding: 0 4px 4px 4px;\n      width: 8px;\n      height: 8px;\n      box-sizing: content-box;\n      transform: translate3d(-50%, 0, 0);\n\n      &:hover {\n        > svg {\n          transform: scale(1.3);\n          opacity: 1;\n          filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));\n        }\n      }\n    "]))),
        marker: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: 0;\n      height: 0;\n      border-left: 4px solid transparent;\n      border-right: 4px solid transparent;\n      border-bottom: 4px solid ", ";\n      pointer-events: none;\n    "], ["\n      width: 0;\n      height: 0;\n      border-left: 4px solid transparent;\n      border-right: 4px solid transparent;\n      border-bottom: 4px solid ", ";\n      pointer-events: none;\n    "])), theme.palette.red),
        wrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      box-shadow: 0 0 20px ", ";\n    "], ["\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      box-shadow: 0 0 20px ", ";\n    "])), bg, headerBg, theme.border.radius.md, shadowColor),
        exemplarsTable: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      width: 100%;\n\n      tr td {\n        padding: 5px 10px;\n        white-space: nowrap;\n        border-bottom: 4px solid ", ";\n      }\n\n      tr {\n        background-color: ", ";\n        &:nth-child(even) {\n          background-color: ", ";\n        }\n      }\n    "], ["\n      width: 100%;\n\n      tr td {\n        padding: 5px 10px;\n        white-space: nowrap;\n        border-bottom: 4px solid ", ";\n      }\n\n      tr {\n        background-color: ", ";\n        &:nth-child(even) {\n          background-color: ", ";\n        }\n      }\n    "])), theme.colors.panelBg, theme.colors.bg1, tableBgOdd),
        valueWrapper: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      flex-wrap: wrap;\n      column-gap: ", ";\n\n      > span {\n        flex-grow: 0;\n      }\n\n      > * {\n        flex: 1 1;\n        align-self: center;\n      }\n    "], ["\n      display: flex;\n      flex-direction: row;\n      flex-wrap: wrap;\n      column-gap: ", ";\n\n      > span {\n        flex-grow: 0;\n      }\n\n      > * {\n        flex: 1 1;\n        align-self: center;\n      }\n    "])), theme.spacing.sm),
        tooltip: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      background: none;\n      padding: 0;\n    "], ["\n      background: none;\n      padding: 0;\n    "]))),
        header: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      background: ", ";\n      padding: 6px 10px;\n      display: flex;\n    "], ["\n      background: ", ";\n      padding: 6px 10px;\n      display: flex;\n    "])), headerBg),
        title: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      font-weight: ", ";\n      padding-right: ", ";\n      overflow: hidden;\n      display: inline-block;\n      white-space: nowrap;\n      text-overflow: ellipsis;\n      flex-grow: 1;\n    "], ["\n      font-weight: ", ";\n      padding-right: ", ";\n      overflow: hidden;\n      display: inline-block;\n      white-space: nowrap;\n      text-overflow: ellipsis;\n      flex-grow: 1;\n    "])), theme.typography.weight.semibold, theme.spacing.md),
        body: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      padding: ", ";\n      font-weight: ", ";\n    "], ["\n      padding: ", ";\n      font-weight: ", ";\n    "])), theme.spacing.sm, theme.typography.weight.semibold),
        marble: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      display: block;\n      opacity: 0.5;\n      transition: transform 0.15s ease-out;\n    "], ["\n      display: block;\n      opacity: 0.5;\n      transition: transform 0.15s ease-out;\n    "]))),
        activeMarble: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n      transform: scale(1.3);\n      opacity: 1;\n      filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));\n    "], ["\n      transform: scale(1.3);\n      opacity: 1;\n      filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11;
//# sourceMappingURL=ExemplarMarker.js.map