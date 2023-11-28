import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React from 'react';
import { Label, RadioButtonGroup, Tag, useStyles2 } from '@grafana/ui';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';
export const AlertInstanceStateFilter = ({ className, onStateFilterChange, stateFilter, filterType, itemPerStateStats, }) => {
    const styles = useStyles2(getStyles);
    const getOptionComponent = (state) => {
        return function InstanceStateCounter() {
            return itemPerStateStats && itemPerStateStats[state] ? (React.createElement(Tag, { name: itemPerStateStats[state].toFixed(0), colorIndex: 9, className: styles.tag })) : null;
        };
    };
    const grafanaOptions = Object.values(GrafanaAlertState).map((state) => ({
        label: state,
        value: state,
        component: getOptionComponent(state),
    }));
    const promOptionValues = [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending];
    const promOptions = promOptionValues.map((state) => ({
        label: capitalize(state),
        value: state,
        component: getOptionComponent(state),
    }));
    const stateOptions = filterType === 'grafana' ? grafanaOptions : promOptions;
    return (React.createElement("div", { className: className, "data-testid": "alert-instance-state-filter" },
        React.createElement(Label, null, "State"),
        React.createElement(RadioButtonGroup, { options: stateOptions, value: stateFilter, onChange: onStateFilterChange, onClick: (v) => {
                if (v === stateFilter) {
                    onStateFilterChange(undefined);
                }
            } })));
};
function getStyles(theme) {
    return {
        tag: css `
      font-size: 11px;
      font-weight: normal;
      padding: ${theme.spacing(0.25, 0.5)};
      vertical-align: middle;
      margin-left: ${theme.spacing(0.5)};
    `,
    };
}
//# sourceMappingURL=AlertInstanceStateFilter.js.map