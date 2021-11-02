import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useCallback, useState } from 'react';
import { css } from '@emotion/css';
import { dateTime, urlUtil } from '@grafana/data';
import { config, getDataSourceSrv, PanelRenderer } from '@grafana/runtime';
import { Alert, CodeEditor, DateTimePicker, LinkButton, useStyles2, useTheme2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import AutoSizer from 'react-virtualized-auto-sizer';
import { PanelPluginsButtonGroup } from '../PanelPluginsButtonGroup';
import { TABLE, TIMESERIES } from '../../utils/constants';
var headerHeight = 4;
export function RuleViewerVisualization(props) {
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    var data = props.data, query = props.query, onChangeQuery = props.onChangeQuery;
    var defaultPanel = isExpressionQuery(query.model) ? TABLE : TIMESERIES;
    var _a = __read(useState(defaultPanel), 2), panel = _a[0], setPanel = _a[1];
    var dsSettings = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
    var relativeTimeRange = query.relativeTimeRange;
    var _b = __read(useState({
        frameIndex: 0,
        showHeader: true,
    }), 2), options = _b[0], setOptions = _b[1];
    var onTimeChange = useCallback(function (newDateTime) {
        var now = dateTime().unix() - newDateTime.unix();
        if (relativeTimeRange) {
            var interval = relativeTimeRange.from - relativeTimeRange.to;
            onChangeQuery(__assign(__assign({}, query), { relativeTimeRange: { from: now + interval, to: now } }));
        }
    }, [onChangeQuery, query, relativeTimeRange]);
    var setDateTime = useCallback(function (relativeTimeRangeTo) {
        return relativeTimeRangeTo === 0 ? dateTime() : dateTime().subtract(relativeTimeRangeTo, 'seconds');
    }, []);
    if (!data) {
        return null;
    }
    if (!dsSettings) {
        return (React.createElement("div", { className: styles.content },
            React.createElement(Alert, { title: "Could not find datasource for query" }),
            React.createElement(CodeEditor, { width: "100%", height: "250px", language: "json", showLineNumbers: false, showMiniMap: false, value: JSON.stringify(query, null, '\t'), readOnly: true })));
    }
    return (React.createElement("div", { className: styles.content },
        React.createElement(AutoSizer, null, function (_a) {
            var width = _a.width, height = _a.height;
            return (React.createElement("div", { style: { width: width, height: height } },
                React.createElement("div", { className: styles.header },
                    React.createElement("div", null, "Query " + query.refId,
                        React.createElement("span", { className: styles.dataSource },
                            "(",
                            dsSettings.name,
                            ")")),
                    React.createElement("div", { className: styles.actions },
                        !isExpressionQuery(query.model) && relativeTimeRange ? (React.createElement(DateTimePicker, { date: setDateTime(relativeTimeRange.to), onChange: onTimeChange, maxDate: new Date() })) : null,
                        React.createElement(PanelPluginsButtonGroup, { onChange: setPanel, value: panel, size: "md" }),
                        !isExpressionQuery(query.model) && (React.createElement(React.Fragment, null,
                            React.createElement("div", { className: styles.spacing }),
                            React.createElement(LinkButton, { size: "md", variant: "secondary", icon: "compass", target: "_blank", href: createExploreLink(dsSettings, query) }, "View in Explore"))))),
                React.createElement(PanelRenderer, { height: height - theme.spacing.gridSize * headerHeight, width: width, data: data, pluginId: panel, title: "", onOptionsChange: setOptions, options: options })));
        })));
}
function createExploreLink(settings, query) {
    var name = settings.name;
    var _a = query.model, refId = _a.refId, rest = __rest(_a, ["refId"]);
    var queryParams = __assign(__assign({}, rest), { datasource: name });
    return urlUtil.renderUrl(config.appSubUrl + "/explore", {
        left: JSON.stringify(['now-1h', 'now', name, queryParams]),
    });
}
var getStyles = function (theme) {
    return {
        content: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 100%;\n      height: 250px;\n    "], ["\n      width: 100%;\n      height: 250px;\n    "]))),
        header: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      height: ", ";\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      white-space: nowrap;\n    "], ["\n      height: ", ";\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      white-space: nowrap;\n    "])), theme.spacing(headerHeight)),
        refId: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      font-weight: ", ";\n      color: ", ";\n      overflow: hidden;\n    "], ["\n      font-weight: ", ";\n      color: ", ";\n      overflow: hidden;\n    "])), theme.typography.fontWeightMedium, theme.colors.text.link),
        dataSource: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-left: ", ";\n      font-style: italic;\n      color: ", ";\n    "], ["\n      margin-left: ", ";\n      font-style: italic;\n      color: ", ";\n    "])), theme.spacing(1), theme.colors.text.secondary),
        actions: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n    "], ["\n      display: flex;\n      align-items: center;\n    "]))),
        spacing: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing(0, 1, 0, 0)),
        errorMessage: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      white-space: pre-wrap;\n    "], ["\n      white-space: pre-wrap;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=RuleViewerVisualization.js.map