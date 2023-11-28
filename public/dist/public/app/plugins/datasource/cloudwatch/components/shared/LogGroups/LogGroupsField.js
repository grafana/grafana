import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { config } from '@grafana/runtime';
import { useAccountOptions } from '../../../hooks';
import { isTemplateVariable } from '../../../utils/templateVariableUtils';
import { LegacyLogGroupSelection } from './LegacyLogGroupNamesSelection';
import { LogGroupsSelector } from './LogGroupsSelector';
import { SelectedLogGroups } from './SelectedLogGroups';
const rowGap = css `
  gap: 3px;
`;
// used in Config Editor and in Log Query Editor
export const LogGroupsField = ({ datasource, onChange, legacyLogGroupNames, logGroups, region, maxNoOfVisibleLogGroups, onBeforeOpen, }) => {
    const accountState = useAccountOptions(datasource === null || datasource === void 0 ? void 0 : datasource.resources, region);
    const [loadingLogGroupsStarted, setLoadingLogGroupsStarted] = useState(false);
    useEffect(() => {
        // If log group names are stored in the query model, make a new DescribeLogGroups request for each log group to load the arn. Then update the query model.
        if (datasource && !loadingLogGroupsStarted && !(logGroups === null || logGroups === void 0 ? void 0 : logGroups.length) && (legacyLogGroupNames === null || legacyLogGroupNames === void 0 ? void 0 : legacyLogGroupNames.length)) {
            setLoadingLogGroupsStarted(true);
            // there's no need to migrate variables, they will be taken care of in the logs query runner
            const variables = legacyLogGroupNames.filter((lgn) => isTemplateVariable(datasource.resources.templateSrv, lgn));
            const legacyLogGroupNameValues = legacyLogGroupNames.filter((lgn) => !isTemplateVariable(datasource.resources.templateSrv, lgn));
            Promise.all(legacyLogGroupNameValues.map((lg) => datasource.resources.getLogGroups({ region: region, logGroupNamePrefix: lg })))
                .then((results) => {
                const logGroups = results.flatMap((r) => r.map((lg) => ({
                    arn: lg.value.arn,
                    name: lg.value.name,
                    accountId: lg.accountId,
                })));
                onChange([...logGroups, ...variables.map((v) => ({ name: v, arn: v }))]);
            })
                .catch((err) => {
                console.error(err);
            });
        }
    }, [datasource, legacyLogGroupNames, logGroups, onChange, region, loadingLogGroupsStarted]);
    return (React.createElement("div", { className: `gf-form gf-form--grow flex-grow-1 ${rowGap}` },
        React.createElement(LogGroupsSelector, { fetchLogGroups: (params) => __awaiter(void 0, void 0, void 0, function* () { var _a; return (_a = datasource === null || datasource === void 0 ? void 0 : datasource.resources.getLogGroups(Object.assign({ region: region }, params))) !== null && _a !== void 0 ? _a : []; }), onChange: onChange, accountOptions: accountState.value, selectedLogGroups: logGroups, onBeforeOpen: onBeforeOpen, variables: datasource === null || datasource === void 0 ? void 0 : datasource.getVariables() }),
        React.createElement(SelectedLogGroups, { selectedLogGroups: logGroups !== null && logGroups !== void 0 ? logGroups : [], onChange: onChange, maxNoOfVisibleLogGroups: maxNoOfVisibleLogGroups })));
};
export const LogGroupsFieldWrapper = (props) => {
    if (!config.featureToggles.cloudWatchCrossAccountQuerying) {
        return (React.createElement(LegacyLogGroupSelection, Object.assign({}, props, { onChange: props.legacyOnChange, legacyLogGroupNames: props.legacyLogGroupNames || [] })));
    }
    return React.createElement(LogGroupsField, Object.assign({}, props));
};
//# sourceMappingURL=LogGroupsField.js.map