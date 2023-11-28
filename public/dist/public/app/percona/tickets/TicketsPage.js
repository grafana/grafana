import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { logger } from 'app/percona/shared/helpers/logger';
import { useSelector } from 'app/types';
import { PlatformConnectedLoader } from '../shared/components/Elements/PlatformConnectedLoader';
import { Table } from '../shared/components/Elements/Table';
import { useCancelToken } from '../shared/components/hooks/cancelToken.hook';
import { getPerconaUser } from '../shared/core/selectors';
import { isApiCancelError } from '../shared/helpers/api';
import { LIST_TICKETS_CANCEL_TOKEN } from './Tickets.constants';
import { Messages } from './Tickets.messages';
import { TicketsService } from './Tickets.service';
import { getStyles } from './Tickets.styles';
export const TicketsPage = () => {
    const [pending, setPending] = useState(true);
    const [data, setData] = useState([]);
    const { isPlatformUser } = useSelector(getPerconaUser);
    const [generateToken] = useCancelToken();
    const styles = useStyles2(getStyles);
    const navModel = usePerconaNavModel('tickets');
    const columns = useMemo(() => [
        {
            Header: Messages.table.columns.number,
            accessor: 'number',
        },
        {
            Header: Messages.table.columns.description,
            accessor: 'shortDescription',
        },
        {
            Header: Messages.table.columns.priority,
            accessor: 'priority',
        },
        {
            Header: Messages.table.columns.state,
            accessor: 'state',
        },
        {
            Header: Messages.table.columns.createDate,
            accessor: 'createTime',
        },
        {
            Header: Messages.table.columns.department,
            accessor: 'department',
        },
        {
            Header: Messages.table.columns.type,
            accessor: 'taskType',
        },
    ], []);
    const getData = useCallback((showLoading = false) => __awaiter(void 0, void 0, void 0, function* () {
        showLoading && setPending(true);
        try {
            const tickets = yield TicketsService.list(generateToken(LIST_TICKETS_CANCEL_TOKEN));
            setData(tickets);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setPending(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    useEffect(() => {
        if (isPlatformUser === true) {
            getData(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlatformUser]);
    const getRowProps = (row) => ({
        key: row.original.url,
        onClick: () => window.open(row.original.url, '_blank'),
        className: styles.rowProps,
    });
    const getCellProps = (cell) => ({
        key: cell.value,
        className: styles.cellProps,
    });
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, { dataTestId: "page-wrapper-tickets" },
            React.createElement(PlatformConnectedLoader, null,
                React.createElement(Table, { data: data, columns: columns, totalItems: data.length, pendingRequest: pending, emptyMessage: Messages.table.noData, getRowProps: getRowProps, getCellProps: getCellProps })))));
};
export default TicketsPage;
//# sourceMappingURL=TicketsPage.js.map