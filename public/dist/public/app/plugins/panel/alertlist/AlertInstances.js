import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import { noop } from 'lodash';
import pluralize from 'pluralize';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, clearButtonStyles, Icon, useStyles2 } from '@grafana/ui';
import { AlertInstancesTable } from 'app/features/alerting/unified/components/rules/AlertInstancesTable';
import { INSTANCES_DISPLAY_LIMIT } from 'app/features/alerting/unified/components/rules/RuleDetails';
import { sortAlerts } from 'app/features/alerting/unified/utils/misc';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../core/constants';
import { GroupMode } from './types';
import { filterAlerts } from './util';
export const AlertInstances = ({ alerts, options, grafanaTotalInstances, handleInstancesLimit, limitInstances, grafanaFilteredInstancesTotal, }) => {
    // when custom grouping is enabled, we will always uncollapse the list of alert instances
    const defaultShowInstances = options.groupMode === GroupMode.Custom ? true : options.showInstances;
    const [displayInstances, setDisplayInstances] = useState(defaultShowInstances);
    const styles = useStyles2(getStyles);
    const clearButton = useStyles2(clearButtonStyles);
    const toggleDisplayInstances = useCallback(() => {
        setDisplayInstances((display) => !display);
    }, []);
    // TODO Filtering instances here has some implications
    // If a rule has 0 instances after filtering there is no way not to show that rule
    const filteredAlerts = useMemo(() => { var _a; return (_a = filterAlerts(options, sortAlerts(options.sortOrder, alerts))) !== null && _a !== void 0 ? _a : []; }, [alerts, options]);
    const isGrafanaAlert = grafanaTotalInstances !== undefined;
    const hiddenInstancesForGrafanaAlerts = grafanaTotalInstances && grafanaFilteredInstancesTotal ? grafanaTotalInstances - grafanaFilteredInstancesTotal : 0;
    const hiddenInstancesForNonGrafanaAlerts = alerts.length - filteredAlerts.length;
    const hiddenInstances = isGrafanaAlert ? hiddenInstancesForGrafanaAlerts : hiddenInstancesForNonGrafanaAlerts;
    const uncollapsible = filteredAlerts.length > 0;
    const toggleShowInstances = uncollapsible ? toggleDisplayInstances : noop;
    useEffect(() => {
        if (filteredAlerts.length === 0) {
            setDisplayInstances(false);
        }
    }, [filteredAlerts]);
    const onShowAllClick = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!handleInstancesLimit) {
            return;
        }
        handleInstancesLimit(false);
        setDisplayInstances(true);
    });
    const onShowLimitedClick = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!handleInstancesLimit) {
            return;
        }
        handleInstancesLimit(true);
        setDisplayInstances(true);
    });
    const totalInstancesGrafana = limitInstances ? grafanaFilteredInstancesTotal : filteredAlerts.length;
    const totalInstancesNotGrafana = filteredAlerts.length;
    const totalInstancesNumber = isGrafanaAlert ? totalInstancesGrafana : totalInstancesNotGrafana;
    const limitStatus = limitInstances
        ? `Showing ${INSTANCES_DISPLAY_LIMIT} of ${grafanaTotalInstances} instances`
        : `Showing all ${grafanaTotalInstances} instances`;
    const limitButtonLabel = limitInstances
        ? 'View all instances'
        : `Limit the result to ${INSTANCES_DISPLAY_LIMIT} instances`;
    const instancesLimitedAndOverflowed = grafanaTotalInstances &&
        INSTANCES_DISPLAY_LIMIT === filteredAlerts.length &&
        grafanaTotalInstances > filteredAlerts.length;
    const instancesNotLimitedAndoverflowed = grafanaTotalInstances && INSTANCES_DISPLAY_LIMIT < filteredAlerts.length && !limitInstances;
    const footerRow = instancesLimitedAndOverflowed || instancesNotLimitedAndoverflowed ? (React.createElement("div", { className: styles.footerRow },
        React.createElement("div", null, limitStatus),
        React.createElement(Button, { size: "sm", variant: "secondary", onClick: limitInstances ? onShowAllClick : onShowLimitedClick }, limitButtonLabel))) : undefined;
    return (React.createElement("div", null,
        options.groupMode === GroupMode.Default && (React.createElement("button", { className: cx(clearButton, uncollapsible ? styles.clickable : ''), onClick: () => toggleShowInstances() },
            uncollapsible && React.createElement(Icon, { name: displayInstances ? 'angle-down' : 'angle-right', size: 'md' }),
            React.createElement("span", null, `${totalInstancesNumber} ${pluralize('instance', totalInstancesNumber)}`),
            hiddenInstances > 0 && React.createElement("span", null,
                ", ",
                `${hiddenInstances} hidden by filters`))),
        displayInstances && (React.createElement(AlertInstancesTable, { instances: filteredAlerts, pagination: { itemsPerPage: 2 * DEFAULT_PER_PAGE_PAGINATION }, footerRow: footerRow }))));
};
const getStyles = (theme) => ({
    clickable: css `
    cursor: pointer;
  `,
    footerRow: css `
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
    justify-content: space-between;
    align-items: center;
    width: 100%;
  `,
});
//# sourceMappingURL=AlertInstances.js.map