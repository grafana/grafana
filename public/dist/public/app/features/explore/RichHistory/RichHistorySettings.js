import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { stylesFactory, useTheme, Select, Button, Switch, Field } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ShowConfirmModalEvent } from '../../../types/events';
import { dispatch } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { MAX_HISTORY_ITEMS } from '../../../core/utils/richHistory';
var getStyles = stylesFactory(function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-size: ", ";\n      .space-between {\n        margin-bottom: ", ";\n      }\n    "], ["\n      font-size: ", ";\n      .space-between {\n        margin-bottom: ", ";\n      }\n    "])), theme.typography.size.sm, theme.spacing.lg),
        input: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      max-width: 200px;\n    "], ["\n      max-width: 200px;\n    "]))),
        switch: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n    "], ["\n      display: flex;\n      align-items: center;\n    "]))),
        label: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing.md),
    };
});
var retentionPeriodOptions = [
    { value: 2, label: '2 days' },
    { value: 5, label: '5 days' },
    { value: 7, label: '1 week' },
    { value: 14, label: '2 weeks' },
];
export function RichHistorySettings(props) {
    var retentionPeriod = props.retentionPeriod, starredTabAsFirstTab = props.starredTabAsFirstTab, activeDatasourceOnly = props.activeDatasourceOnly, onChangeRetentionPeriod = props.onChangeRetentionPeriod, toggleStarredTabAsFirstTab = props.toggleStarredTabAsFirstTab, toggleactiveDatasourceOnly = props.toggleactiveDatasourceOnly, deleteRichHistory = props.deleteRichHistory;
    var theme = useTheme();
    var styles = getStyles(theme);
    var selectedOption = retentionPeriodOptions.find(function (v) { return v.value === retentionPeriod; });
    var onDelete = function () {
        appEvents.publish(new ShowConfirmModalEvent({
            title: 'Delete',
            text: 'Are you sure you want to permanently delete your query history?',
            yesText: 'Delete',
            icon: 'trash-alt',
            onConfirm: function () {
                deleteRichHistory();
                dispatch(notifyApp(createSuccessNotification('Query history deleted')));
            },
        }));
    };
    return (React.createElement("div", { className: styles.container },
        React.createElement(Field, { label: "History time span", description: "Select the period of time for which Grafana will save your query history. Up to " + MAX_HISTORY_ITEMS + " entries will be stored.", className: "space-between" },
            React.createElement("div", { className: styles.input },
                React.createElement(Select, { menuShouldPortal: true, value: selectedOption, options: retentionPeriodOptions, onChange: onChangeRetentionPeriod }))),
        React.createElement(Field, { label: "Default active tab", description: " ", className: "space-between" },
            React.createElement("div", { className: styles.switch },
                React.createElement(Switch, { value: starredTabAsFirstTab, onChange: toggleStarredTabAsFirstTab }),
                React.createElement("div", { className: styles.label }, "Change the default active tab from \u201CQuery history\u201D to \u201CStarred\u201D"))),
        React.createElement(Field, { label: "Data source behaviour", description: " ", className: "space-between" },
            React.createElement("div", { className: styles.switch },
                React.createElement(Switch, { value: activeDatasourceOnly, onChange: toggleactiveDatasourceOnly }),
                React.createElement("div", { className: styles.label }, "Only show queries for data source currently active in Explore"))),
        React.createElement("div", { className: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n          font-weight: ", ";\n        "], ["\n          font-weight: ", ";\n        "])), theme.typography.weight.bold) }, "Clear query history"),
        React.createElement("div", { className: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n          margin-bottom: ", ";\n        "], ["\n          margin-bottom: ", ";\n        "])), theme.spacing.sm) }, "Delete all of your query history, permanently."),
        React.createElement(Button, { variant: "destructive", onClick: onDelete }, "Clear query history")));
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=RichHistorySettings.js.map