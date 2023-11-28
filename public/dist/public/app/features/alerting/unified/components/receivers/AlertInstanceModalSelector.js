import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';
import { Button, clearButtonStyles, FilterInput, LoadingPlaceholder, Modal, Tooltip, useStyles2, Icon, Tag, } from '@grafana/ui';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { arrayLabelsToObject, labelsToTags, objectLabelsToArray } from '../../utils/labels';
import { extractCommonLabels, omitLabels } from '../rules/state-history/common';
export function AlertInstanceModalSelector({ onSelect, isOpen, onClose, }) {
    const styles = useStyles2(getStyles);
    const [selectedRule, setSelectedRule] = useState();
    const [selectedInstances, setSelectedInstances] = useState(null);
    const { useGetAlertmanagerAlertsQuery } = alertmanagerApi;
    const { currentData: result = [], isFetching: loading, isError: error, } = useGetAlertmanagerAlertsQuery({
        amSourceName: GRAFANA_RULES_SOURCE_NAME,
        filter: {
            inhibited: true,
            silenced: true,
            active: true,
        },
    });
    const [ruleFilter, setRuleFilter] = useState('');
    const rulesWithInstances = useMemo(() => {
        const rules = {};
        if (!loading && result) {
            result.forEach((instance) => {
                if (!rules[instance.labels['alertname']]) {
                    rules[instance.labels['alertname']] = [];
                }
                rules[instance.labels['alertname']].push(instance);
            });
        }
        return rules;
    }, [loading, result]);
    const handleRuleChange = useCallback((rule) => {
        setSelectedRule(rule);
        setSelectedInstances(null);
    }, []);
    const filteredRules = useMemo(() => {
        const filteredRules = Object.keys(rulesWithInstances).filter((rule) => rule.toLowerCase().includes(ruleFilter.toLowerCase()));
        const filteredRulesObject = {};
        filteredRules.forEach((rule) => {
            filteredRulesObject[rule] = rulesWithInstances[rule];
        });
        return filteredRulesObject;
    }, [rulesWithInstances, ruleFilter]);
    if (error) {
        return null;
    }
    const filteredRulesKeys = Object.keys(filteredRules || []);
    const RuleRow = ({ index, style }) => {
        var _a;
        if (!filteredRules) {
            return null;
        }
        const ruleName = filteredRulesKeys[index];
        const isSelected = ruleName === selectedRule;
        return (React.createElement("button", { type: "button", title: ruleName, style: style, className: cx(styles.rowButton, { [styles.rowOdd]: index % 2 === 1, [styles.rowSelected]: isSelected }), onClick: () => handleRuleChange(ruleName) },
            React.createElement("div", { className: cx(styles.ruleTitle, styles.rowButtonTitle) }, ruleName),
            React.createElement("div", { className: styles.alertFolder },
                React.createElement(React.Fragment, null,
                    React.createElement(Icon, { name: "folder" }),
                    " ", (_a = filteredRules[ruleName][0].labels['grafana_folder']) !== null && _a !== void 0 ? _a : ''))));
    };
    const getAlertUniqueLabels = (allAlerts, currentAlert) => {
        const allLabels = allAlerts.map((alert) => alert.labels);
        const labelsAsArray = allLabels.map(objectLabelsToArray);
        const ruleCommonLabels = extractCommonLabels(labelsAsArray);
        const alertUniqueLabels = omitLabels(objectLabelsToArray(currentAlert.labels), ruleCommonLabels);
        const tags = alertUniqueLabels.length
            ? labelsToTags(arrayLabelsToObject(alertUniqueLabels))
            : labelsToTags(currentAlert.labels);
        return tags;
    };
    const InstanceRow = ({ index, style }) => {
        const alerts = useMemo(() => (selectedRule ? rulesWithInstances[selectedRule] : []), []);
        const alert = alerts[index];
        const isSelected = selectedInstances === null || selectedInstances === void 0 ? void 0 : selectedInstances.includes(alert);
        const tags = useMemo(() => getAlertUniqueLabels(alerts, alert), [alerts, alert]);
        const handleSelectInstances = () => {
            if (isSelected && selectedInstances) {
                setSelectedInstances(selectedInstances.filter((instance) => instance !== alert));
                return;
            }
            setSelectedInstances([...(selectedInstances || []), alert]);
        };
        return (React.createElement("button", { type: "button", style: style, className: cx(styles.rowButton, styles.instanceButton, {
                [styles.rowOdd]: index % 2 === 1,
                [styles.rowSelected]: isSelected,
            }), onClick: handleSelectInstances },
            React.createElement("div", { className: styles.rowButtonTitle, title: alert.labels['alertname'] },
                React.createElement(Tooltip, { placement: "bottom", content: React.createElement("pre", null, JSON.stringify(alert, null, 2)), theme: 'info' },
                    React.createElement("div", null, tags.map((tag, index) => (React.createElement(Tag, { key: index, name: tag, className: styles.tag }))))))));
    };
    const handleConfirm = () => {
        const instances = (selectedInstances === null || selectedInstances === void 0 ? void 0 : selectedInstances.map((instance) => {
            const alert = {
                annotations: instance.annotations,
                labels: instance.labels,
                startsAt: instance.startsAt,
                endsAt: instance.endsAt,
            };
            return alert;
        })) || [];
        onSelect(instances);
        resetState();
    };
    const resetState = () => {
        setSelectedRule(undefined);
        setSelectedInstances(null);
        setRuleFilter('');
        handleSearchRules('');
    };
    const onDismiss = () => {
        resetState();
        onClose();
    };
    const handleSearchRules = (filter) => {
        setRuleFilter(filter);
    };
    return (React.createElement("div", null,
        React.createElement(Modal, { title: "Select alert instances", className: styles.modal, closeOnEscape: true, isOpen: isOpen, onDismiss: onDismiss, contentClassName: styles.modalContent },
            React.createElement("div", { className: styles.container },
                React.createElement(FilterInput, { value: ruleFilter, onChange: handleSearchRules, title: "Search alert rule", placeholder: "Search alert rule", autoFocus: true }),
                React.createElement("div", null, (selectedRule && 'Select one or more instances from the list below') || ''),
                React.createElement("div", { className: styles.column },
                    loading && React.createElement(LoadingPlaceholder, { text: "Loading rules...", className: styles.loadingPlaceholder }),
                    !loading && (React.createElement(AutoSizer, null, ({ height, width }) => (React.createElement(FixedSizeList, { itemSize: 50, height: height, width: width, itemCount: filteredRulesKeys.length }, RuleRow))))),
                React.createElement("div", { className: styles.column },
                    !selectedRule && !loading && (React.createElement("div", { className: styles.selectedRulePlaceholder },
                        React.createElement("div", null, "Select an alert rule to get a list of available firing instances"))),
                    loading && React.createElement(LoadingPlaceholder, { text: "Loading rule...", className: styles.loadingPlaceholder }),
                    selectedRule && rulesWithInstances[selectedRule].length && !loading && (React.createElement(AutoSizer, null, ({ width, height }) => (React.createElement(FixedSizeList, { itemSize: 32, height: height, width: width, itemCount: rulesWithInstances[selectedRule].length || 0 }, InstanceRow)))))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "button", variant: "secondary", onClick: onDismiss }, "Cancel"),
                React.createElement(Button, { type: "button", variant: "primary", disabled: !(selectedRule && selectedInstances), onClick: () => {
                        if (selectedRule && selectedInstances) {
                            handleConfirm();
                        }
                    } }, "Add alert data to payload")))));
}
const getStyles = (theme) => {
    const clearButton = clearButtonStyles(theme);
    return {
        container: css `
      display: grid;
      grid-template-columns: 1fr 1.5fr;
      grid-template-rows: min-content auto;
      gap: ${theme.spacing(2)};
      flex: 1;
    `,
        tag: css `
      margin: 5px;
    `,
        column: css `
      flex: 1 1 auto;
    `,
        alertLabels: css `
      overflow-x: auto;
      height: 32px;
    `,
        ruleTitle: css `
      height: 22px;
      font-weight: ${theme.typography.fontWeightBold};
    `,
        rowButton: css `
      ${clearButton};
      padding: ${theme.spacing(0.5)};
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
      border: 2px solid transparent;

      &:disabled {
        cursor: not-allowed;
        color: ${theme.colors.text.disabled};
      }
    `,
        rowButtonTitle: css `
      overflow-x: auto;
    `,
        rowSelected: css `
      border-color: ${theme.colors.primary.border};
    `,
        rowOdd: css `
      background-color: ${theme.colors.background.secondary};
    `,
        instanceButton: css `
      display: flex;
      gap: ${theme.spacing(1)};
      justify-content: space-between;
      align-items: center;
    `,
        loadingPlaceholder: css `
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    `,
        selectedRulePlaceholder: css `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      font-weight: ${theme.typography.fontWeightBold};
    `,
        modal: css `
      height: 100%;
    `,
        modalContent: css `
      flex: 1;
      display: flex;
      flex-direction: column;
    `,
        modalAlert: css `
      flex-grow: 0;
    `,
        warnIcon: css `
      fill: ${theme.colors.warning.main};
    `,
        labels: css `
      justify-content: flex-start;
    `,
        alertFolder: css `
      height: 20px;
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
      column-gap: ${theme.spacing(1)};
      align-items: center;
    `,
    };
};
//# sourceMappingURL=AlertInstanceModalSelector.js.map