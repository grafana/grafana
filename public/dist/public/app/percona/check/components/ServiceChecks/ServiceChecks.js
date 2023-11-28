import { __awaiter } from "tslib";
/* eslint-disable react/display-name */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { Severity } from 'app/percona/integrated-alerting/components/Severity';
import { Chip } from 'app/percona/shared/components/Elements/Chip';
import { ExpandableCell } from 'app/percona/shared/components/Elements/ExpandableCell';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { useStoredTablePageSize } from 'app/percona/shared/components/Elements/Table/Pagination';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { CheckService } from '../../Check.service';
import { formatServiceId } from '../FailedChecksTab/FailedChecksTab.utils';
import { SERVICE_CHECKS_CANCEL_TOKEN, SERVICE_CHECKS_TABLE_ID } from './ServiceChecks.constants';
import { Messages } from './ServiceChecks.messages';
import { getStyles } from './ServiceChecks.styles';
export const ServiceChecks = ({ match }) => {
    const serviceId = formatServiceId(match.params.service);
    const [pageSize, setPageSize] = useStoredTablePageSize(SERVICE_CHECKS_TABLE_ID);
    const [pageIndex, setPageindex] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [data, setData] = useState([]);
    const [pending, setPending] = useState(false);
    const [serviceName, setServiceName] = useState('');
    const [generateToken] = useCancelToken();
    const styles = useStyles2(getStyles);
    const navModel = usePerconaNavModel('advisors-insights');
    const fetchChecks = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            setPending(true);
            const { data, totals: { totalItems, totalPages }, } = yield CheckService.getFailedCheckForService(serviceId, pageSize, pageIndex, generateToken(SERVICE_CHECKS_CANCEL_TOKEN));
            setData(data);
            setServiceName(data[0].serviceName);
            setTotalItems(totalItems);
            setTotalPages(totalPages);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setPending(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [pageIndex, pageSize, serviceId]);
    const columns = useMemo(() => [
        {
            Header: 'Check Name',
            accessor: 'checkName',
            Cell: ({ row, value }) => React.createElement(ExpandableCell, { row: row, value: value }),
        },
        {
            Header: 'Summary',
            accessor: 'summary',
            noHiddenOverflow: true,
        },
        {
            Header: 'Description',
            accessor: 'description',
            noHiddenOverflow: true,
        },
        {
            Header: 'Severity',
            accessor: 'severity',
            Cell: ({ value }) => React.createElement(Severity, { severity: value }),
        },
        {
            Header: 'Details',
            accessor: 'readMoreUrl',
            width: '105px',
            Cell: ({ value }) => value ? (React.createElement("a", { "data-testid": "read-more-link", target: "_blank", rel: "noreferrer", href: value, className: styles.link }, Messages.readMore)) : null,
        },
    ], [styles.link]);
    const onPaginationChanged = useCallback((pageSize, pageIndex) => {
        setPageSize(pageSize);
        setPageindex(pageIndex);
    }, [setPageindex, setPageSize]);
    const getCellProps = useCallback((cell) => ({
        className: !!cell.row.original.silenced ? styles.disabledRow : '',
        key: cell.row.original.alertId,
    }), [styles.disabledRow]);
    const renderSelectedSubRow = React.useCallback((row) => (React.createElement("div", { className: styles.secondaryLabels }, [...row.original.labels.primary, ...row.original.labels.secondary].map((label) => (React.createElement(Chip, { key: label, text: label }))))), [styles.secondaryLabels]);
    useEffect(() => {
        fetchChecks();
    }, [fetchChecks]);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, { dataTestId: "db-service-checks" },
            React.createElement("h3", { "data-testid": "page-service" }, Messages.pageTitle(serviceName)),
            React.createElement(Table, { showPagination: true, data: data, columns: columns, totalItems: totalItems, totalPages: totalPages, pageSize: pageSize, pageIndex: pageIndex, onPaginationChanged: onPaginationChanged, renderExpandedRow: renderSelectedSubRow, getCellProps: getCellProps, pendingRequest: pending, emptyMessage: Messages.noChecks }))));
};
export default ServiceChecks;
//# sourceMappingURL=ServiceChecks.js.map