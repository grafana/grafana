import { __awaiter } from "tslib";
import { debounce, unionBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toOption } from '@grafana/data';
import { MultiSelect } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';
import { appendTemplateVariables } from '../../../utils/utils';
const MAX_LOG_GROUPS = 20;
const MAX_VISIBLE_LOG_GROUPS = 4;
const DEBOUNCE_TIMER = 300;
export const LogGroupSelector = ({ region, selectedLogGroups, onChange, datasource, onOpenMenu, width, saved = true, }) => {
    const [loadingLogGroups, setLoadingLogGroups] = useState(false);
    const [availableLogGroups, setAvailableLogGroups] = useState([]);
    const logGroupOptions = useMemo(() => unionBy(availableLogGroups, selectedLogGroups === null || selectedLogGroups === void 0 ? void 0 : selectedLogGroups.map(toOption), 'value'), [availableLogGroups, selectedLogGroups]);
    const fetchLogGroupOptions = useCallback((region, logGroupNamePrefix) => __awaiter(void 0, void 0, void 0, function* () {
        if (!datasource) {
            return [];
        }
        try {
            const logGroups = yield datasource.resources.legacyDescribeLogGroups(region, logGroupNamePrefix);
            return logGroups;
        }
        catch (err) {
            dispatch(notifyApp(createErrorNotification(typeof err === 'string' ? err : JSON.stringify(err))));
            return [];
        }
    }), [datasource]);
    const onLogGroupSearch = (searchTerm, region, actionMeta) => __awaiter(void 0, void 0, void 0, function* () {
        if (actionMeta.action !== 'input-change' || !datasource) {
            return;
        }
        // No need to fetch matching log groups if the search term isn't valid
        // This is also useful for preventing searches when a user is typing out a log group with template vars
        // See https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html for the source of the pattern below
        const logGroupNamePattern = /^[\.\-_/#A-Za-z0-9]+$/;
        if (!logGroupNamePattern.test(searchTerm)) {
            if (searchTerm !== '') {
                dispatch(notifyApp(createErrorNotification('Invalid Log Group name: ' + searchTerm)));
            }
            return;
        }
        setLoadingLogGroups(true);
        const matchingLogGroups = yield fetchLogGroupOptions(region, searchTerm);
        setAvailableLogGroups(unionBy(availableLogGroups, matchingLogGroups, 'value'));
        setLoadingLogGroups(false);
    });
    // Reset the log group options if the datasource or region change and are saved
    useEffect(() => {
        function getAvailableLogGroupOptions() {
            return __awaiter(this, void 0, void 0, function* () {
                // Don't call describeLogGroups if datasource or region is undefined
                if (!datasource || !datasource.getActualRegion(region)) {
                    setAvailableLogGroups([]);
                    return;
                }
                setLoadingLogGroups(true);
                return fetchLogGroupOptions(datasource.getActualRegion(region))
                    .then((logGroups) => {
                    setAvailableLogGroups(logGroups);
                })
                    .finally(() => {
                    setLoadingLogGroups(false);
                });
            });
        }
        // Config editor does not fetch new log group options unless changes have been saved
        saved && getAvailableLogGroupOptions();
        // if component unmounts in the middle of setting state, we reset state and unsubscribe from fetchLogGroupOptions
        return () => {
            setAvailableLogGroups([]);
            setLoadingLogGroups(false);
        };
        // this hook shouldn't get called every time selectedLogGroups or onChange updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datasource, region, saved]);
    const onOpenLogGroupMenu = () => __awaiter(void 0, void 0, void 0, function* () {
        if (onOpenMenu) {
            yield onOpenMenu();
        }
    });
    const onLogGroupSearchDebounced = debounce(onLogGroupSearch, DEBOUNCE_TIMER);
    return (React.createElement(MultiSelect, { inputId: "default-log-groups", "aria-label": "Log Groups", allowCustomValue: true, options: datasource ? appendTemplateVariables(datasource, logGroupOptions) : logGroupOptions, value: selectedLogGroups, onChange: (v) => onChange(v.filter(({ value }) => value).map(({ value }) => value)), closeMenuOnSelect: false, isClearable: true, isOptionDisabled: () => selectedLogGroups.length >= MAX_LOG_GROUPS, placeholder: "Choose Log Groups", maxVisibleValues: MAX_VISIBLE_LOG_GROUPS, noOptionsMessage: "No log groups available", isLoading: loadingLogGroups, onOpenMenu: onOpenLogGroupMenu, onInputChange: (value, actionMeta) => {
            onLogGroupSearchDebounced(value, region, actionMeta);
        }, width: width }));
};
//# sourceMappingURL=LegacyLogGroupSelector.js.map