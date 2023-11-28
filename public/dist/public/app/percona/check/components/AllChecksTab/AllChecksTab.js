import { __awaiter } from "tslib";
import React, { useCallback, useMemo, useState } from 'react';
import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { OldPage } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { CheckService } from 'app/percona/check/Check.service';
import { Interval } from 'app/percona/check/types';
import { CustomCollapsableSection } from 'app/percona/shared/components/Elements/CustomCollapsableSection/CustomCollapsableSection';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchAdvisors } from 'app/percona/shared/core/reducers/advisors/advisors';
import { getAdvisors, getCategorizedAdvisors, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { logger } from 'app/percona/shared/helpers/logger';
import { dispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { Messages as mainChecksMessages } from '../../CheckPanel.messages';
import { ChecksInfoAlert } from '../CheckInfoAlert/CheckInfoAlert';
import { Messages } from './AllChecksTab.messages';
import { getStyles } from './AllChecksTab.styles';
import { ChangeCheckIntervalModal } from './ChangeCheckIntervalModal';
import { CheckActions } from './CheckActions/CheckActions';
export const AllChecksTab = ({ match, }) => {
    const category = match.params.category;
    const navModel = usePerconaNavModel(`advisors-${category}`);
    const [runChecksPending, setRunChecksPending] = useState(false);
    const [checkIntervalModalVisible, setCheckIntervalModalVisible] = useState(false);
    const [selectedCheck, setSelectedCheck] = useState();
    const styles = useStyles2(getStyles);
    const { loading: advisorsPending } = useSelector(getAdvisors);
    const categorizedAdvisors = useSelector(getCategorizedAdvisors);
    const advisors = categorizedAdvisors[category];
    const [queryParams] = useQueryParams();
    if (navModel.main.id === 'not-found') {
        locationService.push('/advisors');
    }
    const getCheckNamesListInCategory = () => {
        return Object.values(advisors)
            .map((advisor) => advisor.checks)
            .flat()
            .map((check) => check.name);
    };
    const handleRunChecksClick = () => __awaiter(void 0, void 0, void 0, function* () {
        setRunChecksPending(true);
        try {
            yield CheckService.runDbChecks(getCheckNamesListInCategory());
            appEvents.emit(AppEvents.alertSuccess, [Messages.checksExecutionStarted]);
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            setRunChecksPending(false);
        }
    });
    const runIndividualCheck = (check) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield CheckService.runIndividualDbCheck(check.name);
            appEvents.emit(AppEvents.alertSuccess, [`${check.summary} ${Messages.runIndividualDbCheck}`]);
        }
        catch (e) {
            logger.error(e);
        }
        finally {
        }
    });
    const changeCheck = useCallback((check) => __awaiter(void 0, void 0, void 0, function* () {
        const action = !!check.disabled ? 'enable' : 'disable';
        try {
            yield CheckService.changeCheck({ params: [{ name: check.name, [action]: true }] });
            yield dispatch(fetchAdvisors());
        }
        catch (e) {
            logger.error(e);
        }
    }), []);
    const handleIntervalChangeClick = useCallback((check) => {
        setSelectedCheck(check);
        setCheckIntervalModalVisible(true);
    }, []);
    const handleModalClose = useCallback(() => {
        setCheckIntervalModalVisible(false);
        setSelectedCheck(undefined);
    }, []);
    const handleIntervalChanged = useCallback((check) => __awaiter(void 0, void 0, void 0, function* () {
        yield dispatch(fetchAdvisors());
        handleModalClose();
    }), [handleModalClose]);
    const columns = useMemo(() => [
        {
            Header: Messages.table.columns.name,
            accessor: 'summary',
            type: FilterFieldTypes.TEXT,
        },
        {
            Header: Messages.table.columns.description,
            accessor: 'description',
            type: FilterFieldTypes.TEXT,
            noHiddenOverflow: true,
        },
        {
            Header: Messages.table.columns.status,
            accessor: 'disabled',
            Cell: ({ value }) => React.createElement(React.Fragment, null, !!value ? Messages.disabled : Messages.enabled),
            type: FilterFieldTypes.RADIO_BUTTON,
            options: [
                {
                    label: Messages.enabled,
                    value: false,
                },
                {
                    label: Messages.disabled,
                    value: true,
                },
            ],
        },
        {
            Header: Messages.table.columns.family,
            accessor: 'family',
            type: FilterFieldTypes.TEXT,
            noHiddenOverflow: true,
        },
        {
            Header: Messages.table.columns.interval,
            accessor: 'interval',
            Cell: ({ value }) => React.createElement(React.Fragment, null, Interval[value]),
            type: FilterFieldTypes.DROPDOWN,
            options: [
                {
                    label: Interval.STANDARD,
                    value: Interval.STANDARD,
                },
                {
                    label: Interval.RARE,
                    value: Interval.RARE,
                },
                {
                    label: Interval.FREQUENT,
                    value: Interval.FREQUENT,
                },
            ],
        },
        {
            Header: Messages.table.columns.actions,
            accessor: 'name',
            id: 'actions',
            // eslint-disable-next-line react/display-name
            Cell: ({ row }) => (React.createElement(CheckActions, { check: row.original, onChangeCheck: changeCheck, onIntervalChangeClick: handleIntervalChangeClick, onIndividualRunCheckClick: runIndividualCheck })),
        },
    ], [changeCheck, handleIntervalChangeClick]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('sttEnabled'), []);
    const isFilterSet = (queryParams, advisorName) => {
        return Object.keys(queryParams).includes(advisorName);
    };
    return (React.createElement(OldPage, { navModel: navModel, tabsDataTestId: "db-check-tabs-bar", "data-testid": "db-check-panel" },
        React.createElement(OldPage.Contents, { dataTestId: "db-check-tab-content" },
            React.createElement(FeatureLoader, { messagedataTestId: "db-check-panel-settings-link", featureName: mainChecksMessages.advisors, featureSelector: featureSelector },
                React.createElement(ChecksInfoAlert, null),
                React.createElement("div", { className: styles.wrapper },
                    React.createElement("div", { className: styles.header },
                        React.createElement("h1", null, Messages.availableHeader),
                        React.createElement("div", { className: styles.actionButtons, "data-testid": "db-check-panel-actions" },
                            React.createElement(LoaderButton, { type: "button", variant: "secondary", size: "md", loading: runChecksPending, onClick: handleRunChecksClick, className: styles.runChecksButton }, Messages.runDbChecks))),
                    advisors &&
                        Object.keys(advisors).map((summary) => (React.createElement(CustomCollapsableSection, { key: summary, mainLabel: summary, content: advisors[summary].description, sideLabel: advisors[summary].comment, isInitOpen: isFilterSet(queryParams, advisors[summary].name) },
                            React.createElement(Table, { totalItems: advisors[summary].checks.length, data: advisors[summary].checks, columns: columns, pendingRequest: advisorsPending, emptyMessage: Messages.table.noData, tableKey: advisors[summary].name, showFilter: true }),
                            !!selectedCheck && checkIntervalModalVisible && (React.createElement(ChangeCheckIntervalModal, { check: selectedCheck, onClose: handleModalClose, onIntervalChanged: handleIntervalChanged }))))))))));
};
export default AllChecksTab;
//# sourceMappingURL=AllChecksTab.js.map