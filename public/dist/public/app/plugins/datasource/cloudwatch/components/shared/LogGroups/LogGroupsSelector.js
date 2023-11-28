import { __awaiter, __rest } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import { EditorField, Space } from '@grafana/experimental';
import { Button, Checkbox, Icon, Label, LoadingPlaceholder, Modal, Select, useStyles2 } from '@grafana/ui';
import getStyles from '../../styles';
import { Account, ALL_ACCOUNTS_OPTION } from '../Account';
import Search from './Search';
export const LogGroupsSelector = (_a) => {
    var _b;
    var { accountOptions = [], variables = [], fetchLogGroups, onChange, onBeforeOpen } = _a, props = __rest(_a, ["accountOptions", "variables", "fetchLogGroups", "onChange", "onBeforeOpen"]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectableLogGroups, setSelectableLogGroups] = useState([]);
    const [selectedLogGroups, setSelectedLogGroups] = useState((_b = props.selectedLogGroups) !== null && _b !== void 0 ? _b : []);
    const [searchPhrase, setSearchPhrase] = useState('');
    const [searchAccountId, setSearchAccountId] = useState(ALL_ACCOUNTS_OPTION.value);
    const [isLoading, setIsLoading] = useState(false);
    const styles = useStyles2(getStyles);
    const selectedLogGroupsCounter = useMemo(() => selectedLogGroups.filter((lg) => { var _a; return !((_a = lg.name) === null || _a === void 0 ? void 0 : _a.startsWith('$')); }).length, [selectedLogGroups]);
    const variableOptions = useMemo(() => variables.map((v) => ({ label: v, value: v })), [variables]);
    const selectedVariable = useMemo(() => { var _a; return (_a = selectedLogGroups.find((lg) => { var _a; return (_a = lg.name) === null || _a === void 0 ? void 0 : _a.startsWith('$'); })) === null || _a === void 0 ? void 0 : _a.name; }, [selectedLogGroups]);
    const currentVariableOption = {
        label: selectedVariable,
        value: selectedVariable,
    };
    useEffect(() => {
        var _a;
        setSelectedLogGroups((_a = props.selectedLogGroups) !== null && _a !== void 0 ? _a : []);
    }, [props.selectedLogGroups]);
    const toggleModal = () => {
        setIsModalOpen(!isModalOpen);
        if (isModalOpen) {
        }
        else {
            setSelectedLogGroups(selectedLogGroups);
            searchFn(searchPhrase, searchAccountId);
        }
    };
    const accountNameById = useMemo(() => {
        const idsToNames = {};
        accountOptions.forEach((a) => {
            if (a.value && a.label) {
                idsToNames[a.value] = a.label;
            }
        });
        return idsToNames;
    }, [accountOptions]);
    const searchFn = (searchTerm, accountId) => __awaiter(void 0, void 0, void 0, function* () {
        setIsLoading(true);
        try {
            const possibleLogGroups = yield fetchLogGroups({
                logGroupPattern: searchTerm,
                accountId: accountId,
            });
            setSelectableLogGroups(possibleLogGroups.map((lg) => ({
                arn: lg.value.arn,
                name: lg.value.name,
                accountId: lg.accountId,
                accountLabel: lg.accountId ? accountNameById[lg.accountId] : undefined,
            })));
        }
        catch (err) {
            setSelectableLogGroups([]);
        }
        setIsLoading(false);
    });
    const handleSelectCheckbox = (row, isChecked) => {
        if (isChecked) {
            setSelectedLogGroups([...selectedLogGroups, row]);
        }
        else {
            setSelectedLogGroups(selectedLogGroups.filter((lg) => lg.arn !== row.arn));
        }
    };
    const handleApply = () => {
        onChange(selectedLogGroups);
        toggleModal();
    };
    const handleCancel = () => {
        setSelectedLogGroups(selectedLogGroups);
        toggleModal();
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Modal, { className: styles.modal, title: "Select log groups", isOpen: isModalOpen, onDismiss: toggleModal },
            React.createElement("div", { className: styles.logGroupSelectionArea },
                React.createElement("div", { className: styles.searchField },
                    React.createElement(EditorField, { label: "Log group name prefix" },
                        React.createElement(Search, { searchFn: (phrase) => {
                                searchFn(phrase, searchAccountId);
                                setSearchPhrase(phrase);
                            }, searchPhrase: searchPhrase }))),
                React.createElement(Account, { onChange: (accountId) => {
                        searchFn(searchPhrase, accountId);
                        setSearchAccountId(accountId || ALL_ACCOUNTS_OPTION.value);
                    }, accountOptions: accountOptions, accountId: searchAccountId })),
            React.createElement(Space, { layout: "block", v: 2 }),
            React.createElement("div", null,
                !isLoading && selectableLogGroups.length >= 25 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: styles.limitLabel },
                        React.createElement(Icon, { name: "info-circle" }),
                        "Only the first 50 results can be shown. If you do not see an expected log group, try narrowing down your search.",
                        React.createElement("p", null,
                            "A",
                            ' ',
                            React.createElement("a", { target: "_blank", rel: "noopener noreferrer", href: "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/cloudwatch_limits_cwl.html" },
                                "maximum",
                                ' '),
                            ' ',
                            "of 50 Cloudwatch log groups can be queried at one time.")),
                    React.createElement(Space, { layout: "block", v: 1 }))),
                React.createElement("div", { className: styles.tableScroller },
                    React.createElement("table", { className: styles.table },
                        React.createElement("thead", null,
                            React.createElement("tr", { className: styles.row },
                                React.createElement("td", { className: styles.cell }, "Log Group"),
                                accountOptions.length > 0 && React.createElement("td", { className: styles.cell }, "Account label"),
                                React.createElement("td", { className: styles.cell }, "Account ID"))),
                        React.createElement("tbody", null,
                            isLoading && (React.createElement("tr", { className: styles.row },
                                React.createElement("td", { className: styles.cell },
                                    React.createElement(LoadingPlaceholder, { text: 'Loading...' })))),
                            !isLoading && selectableLogGroups.length === 0 && (React.createElement("tr", { className: styles.row },
                                React.createElement("td", { className: styles.cell }, "No log groups found"))),
                            !isLoading &&
                                selectableLogGroups.map((row) => (React.createElement("tr", { className: styles.row, key: `${row.arn}` },
                                    React.createElement("td", { className: styles.cell },
                                        React.createElement("div", { className: styles.nestedEntry },
                                            React.createElement(Checkbox, { id: row.arn, onChange: (ev) => handleSelectCheckbox(row, ev.currentTarget.checked), value: !!(row.arn && selectedLogGroups.some((lg) => lg.arn === row.arn)) }),
                                            React.createElement(Space, { layout: "inline", h: 2 }),
                                            React.createElement("label", { className: styles.logGroupSearchResults, htmlFor: row.arn, title: row.name }, row.name))),
                                    accountOptions.length > 0 && React.createElement("td", { className: styles.cell }, row.accountLabel),
                                    React.createElement("td", { className: styles.cell }, row.accountId)))))))),
            React.createElement(Space, { layout: "block", v: 2 }),
            React.createElement(Label, { className: styles.logGroupCountLabel },
                selectedLogGroupsCounter,
                " log group",
                selectedLogGroupsCounter !== 1 && 's',
                " selected"),
            React.createElement(Space, { layout: "block", v: 1 }),
            React.createElement(EditorField, { label: "Template variable", width: 26, tooltip: "Optionally you can specify a single or multi-valued template variable. Select a variable separately or in conjunction with log groups." },
                React.createElement(Select, { isClearable: true, "aria-label": "Template variable", value: currentVariableOption, allowCustomValue: true, options: variableOptions, onChange: (option) => {
                        const newValues = selectedLogGroups.filter((lg) => { var _a; return !((_a = lg.name) === null || _a === void 0 ? void 0 : _a.startsWith('$')); });
                        if (option === null || option === void 0 ? void 0 : option.label) {
                            newValues.push({ name: option.label, arn: option.label });
                        }
                        setSelectedLogGroups(newValues);
                    } })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { onClick: handleCancel, variant: "secondary", type: "button", fill: "outline" }, "Cancel"),
                React.createElement(Button, { onClick: handleApply, type: "button" }, "Add log groups"))),
        React.createElement("div", null,
            React.createElement(Button, { variant: "secondary", onClick: () => {
                    try {
                        onBeforeOpen === null || onBeforeOpen === void 0 ? void 0 : onBeforeOpen();
                        toggleModal();
                    }
                    catch (err) { }
                }, type: "button" }, "Select log groups"))));
};
//# sourceMappingURL=LogGroupsSelector.js.map