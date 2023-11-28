import { css } from '@emotion/css';
import React from 'react';
import { getAppEvents } from '@grafana/runtime';
import { useStyles2, Select, Button, Field, InlineField, InlineSwitch, Alert } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { MAX_HISTORY_ITEMS } from 'app/core/history/RichHistoryLocalStorage';
import { dispatch } from 'app/store/store';
import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
import { ShowConfirmModalEvent } from '../../../types/events';
const getStyles = (theme) => {
    return {
        container: css `
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
        spaceBetween: css `
      margin-bottom: ${theme.spacing(3)};
    `,
        input: css `
      max-width: 200px;
    `,
        bold: css `
      font-weight: ${theme.typography.fontWeightBold};
    `,
        bottomMargin: css `
      margin-bottom: ${theme.spacing(1)};
    `,
    };
};
const retentionPeriodOptions = [
    { value: 2, label: '2 days' },
    { value: 5, label: '5 days' },
    { value: 7, label: '1 week' },
    { value: 14, label: '2 weeks' },
];
export function RichHistorySettingsTab(props) {
    const { retentionPeriod, starredTabAsFirstTab, activeDatasourceOnly, onChangeRetentionPeriod, toggleStarredTabAsFirstTab, toggleactiveDatasourceOnly, deleteRichHistory, } = props;
    const styles = useStyles2(getStyles);
    const selectedOption = retentionPeriodOptions.find((v) => v.value === retentionPeriod);
    const onDelete = () => {
        getAppEvents().publish(new ShowConfirmModalEvent({
            title: 'Delete',
            text: 'Are you sure you want to permanently delete your query history?',
            yesText: 'Delete',
            icon: 'trash-alt',
            onConfirm: () => {
                deleteRichHistory();
                dispatch(notifyApp(createSuccessNotification('Query history deleted')));
            },
        }));
    };
    return (React.createElement("div", { className: styles.container },
        supportedFeatures().changeRetention ? (React.createElement(Field, { label: "History time span", description: `Select the period of time for which Grafana will save your query history. Up to ${MAX_HISTORY_ITEMS} entries will be stored.` },
            React.createElement("div", { className: styles.input },
                React.createElement(Select, { value: selectedOption, options: retentionPeriodOptions, onChange: onChangeRetentionPeriod })))) : (React.createElement(Alert, { severity: "info", title: "History time span" },
            "Grafana will keep entries up to ", selectedOption === null || selectedOption === void 0 ? void 0 :
            selectedOption.label,
            ". Starred entries won't be deleted.")),
        React.createElement(InlineField, { label: "Change the default active tab from \u201CQuery history\u201D to \u201CStarred\u201D", className: styles.spaceBetween },
            React.createElement(InlineSwitch, { id: "explore-query-history-settings-default-active-tab", value: starredTabAsFirstTab, onChange: toggleStarredTabAsFirstTab })),
        supportedFeatures().onlyActiveDataSource && (React.createElement(InlineField, { label: "Only show queries for data source currently active in Explore", className: styles.spaceBetween },
            React.createElement(InlineSwitch, { id: "explore-query-history-settings-data-source-behavior", value: activeDatasourceOnly, onChange: toggleactiveDatasourceOnly }))),
        supportedFeatures().clearHistory && (React.createElement("div", null,
            React.createElement("div", { className: styles.bold }, "Clear query history"),
            React.createElement("div", { className: styles.bottomMargin }, "Delete all of your query history, permanently."),
            React.createElement(Button, { variant: "destructive", onClick: onDelete }, "Clear query history")))));
}
//# sourceMappingURL=RichHistorySettingsTab.js.map