import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { AlertsReloadContext } from 'app/percona/check/Check.context';
import { CheckService } from 'app/percona/check/Check.service';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { Messages as mainChecksMessages } from '../../CheckPanel.messages';
import { ChecksInfoAlert } from '../CheckInfoAlert/CheckInfoAlert';
import { GET_ACTIVE_ALERTS_CANCEL_TOKEN } from './FailedChecksTab.constants';
import { Messages } from './FailedChecksTab.messages';
import { getStyles } from './FailedChecksTab.styles';
import { stripServiceId } from './FailedChecksTab.utils';
import { Failures } from './Failures/Failures';
export const FailedChecksTab = () => {
    const [fetchAlertsPending, setFetchAlertsPending] = useState(true);
    const navModel = usePerconaNavModel('advisors-insights');
    const [data, setData] = useState([]);
    const styles = useStyles2(getStyles);
    const [generateToken] = useCancelToken();
    const columns = useMemo(() => [
        {
            Header: 'Service Name',
            accessor: 'serviceName',
        },
        {
            Header: 'Fail Count by Severity',
            accessor: 'counts',
            // eslint-disable-next-line react/display-name
            Cell: ({ value }) => React.createElement(Failures, { counts: value }),
        },
    ], []);
    const fetchAlerts = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setFetchAlertsPending(true);
        try {
            const checks = yield CheckService.getAllFailedChecks(generateToken(GET_ACTIVE_ALERTS_CANCEL_TOKEN));
            setData(checks);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setFetchAlertsPending(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const getRowProps = (row) => ({
        key: row.original.serviceId,
        className: styles.row,
        onClick: () => locationService.push(`/advisors/insights/${stripServiceId(row.original.serviceId)}`),
    });
    const getCellProps = (cellInfo) => ({
        key: `${cellInfo.row.original.serviceId}-${cellInfo.row.id}`,
        className: styles.cell,
    });
    useEffect(() => {
        fetchAlerts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('sttEnabled'), []);
    return (React.createElement(OldPage, { navModel: navModel, tabsDataTestId: "db-check-tabs-bar", "data-testid": "db-check-panel" },
        React.createElement(OldPage.Contents, { dataTestId: "db-check-tab-content" },
            React.createElement(FeatureLoader, { messagedataTestId: "db-check-panel-settings-link", featureName: mainChecksMessages.advisors, featureSelector: featureSelector },
                React.createElement(ChecksInfoAlert, null),
                React.createElement(AlertsReloadContext.Provider, { value: { fetchAlerts } },
                    React.createElement(Table, { totalItems: data.length, data: data, getRowProps: getRowProps, getCellProps: getCellProps, columns: columns, pendingRequest: fetchAlertsPending, emptyMessage: Messages.noChecks }))))));
};
export default FailedChecksTab;
//# sourceMappingURL=FailedChecksTab.js.map