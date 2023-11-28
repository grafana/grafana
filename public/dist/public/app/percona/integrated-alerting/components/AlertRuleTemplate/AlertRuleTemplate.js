import { __awaiter } from "tslib";
/* eslint-disable react/display-name */
import { format } from 'date-fns';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { OldPage } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useStoredTablePageSize } from '../../../shared/components/Elements/Table/Pagination';
import { Table } from '../../../shared/components/Elements/Table/Table';
import { Messages } from '../../IntegratedAlerting.messages';
import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';
import { ALERT_RULE_TEMPLATES_TABLE_ID, GET_TEMPLATES_CANCEL_TOKEN } from './AlertRuleTemplate.constants';
import { AlertRuleTemplateService } from './AlertRuleTemplate.service';
import { getStyles } from './AlertRuleTemplate.styles';
import { formatSource, formatTemplates } from './AlertRuleTemplate.utils';
import { AlertRuleTemplateActions } from './AlertRuleTemplateActions/AlertRuleTemplateActions';
const { columns } = Messages.alertRuleTemplate.table;
const { name: nameColumn, source: sourceColumn, actions: actionsColumn } = columns;
export const AlertRuleTemplate = () => {
    const styles = useStyles2(getStyles);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [pendingRequest, setPendingRequest] = useState(true);
    const navModel = useNavModel('integrated-alerting-templates');
    const [data, setData] = useState([]);
    const [pageSize, setPageSize] = useStoredTablePageSize(ALERT_RULE_TEMPLATES_TABLE_ID);
    const [pageIndex, setPageindex] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [generateToken] = useCancelToken();
    const getAlertRuleTemplates = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setPendingRequest(true);
        try {
            const { templates, totals } = yield AlertRuleTemplateService.list({
                page_params: {
                    index: pageIndex,
                    page_size: pageSize,
                },
            }, generateToken(GET_TEMPLATES_CANCEL_TOKEN));
            setData(formatTemplates(templates));
            setTotalItems(totals.total_items || 0);
            setTotalPages(totals.total_pages || 0);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setPendingRequest(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [pageIndex, pageSize]);
    const columns = React.useMemo(() => [
        {
            Header: nameColumn,
            accessor: 'summary',
            width: '60%',
        },
        {
            Header: sourceColumn,
            accessor: 'source',
            width: '30%',
            Cell: ({ value, row }) => {
                return (React.createElement("div", null,
                    formatSource(value),
                    React.createElement("br", null),
                    row.original.created_at && (React.createElement("span", { className: styles.dateWrapper },
                        "Created at: ",
                        format(new Date(row.original.created_at), 'yyyy-MM-dd')))));
            },
        },
        {
            Header: actionsColumn,
            accessor: (template) => (React.createElement(AlertRuleTemplateActions, { template: template, getAlertRuleTemplates: getAlertRuleTemplates })),
        },
    ], [getAlertRuleTemplates, styles.dateWrapper]);
    const handlePaginationChanged = useCallback((pageSize, pageIndex) => {
        setPageSize(pageSize);
        setPageindex(pageIndex);
    }, [setPageSize, setPageindex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('alertingEnabled'), []);
    const handleAddButton = () => {
        setAddModalVisible((visible) => !visible);
    };
    useEffect(() => {
        getAlertRuleTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, pageIndex]);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, null,
            React.createElement(FeatureLoader, { featureName: Messages.alerting, featureSelector: featureSelector },
                React.createElement("div", { className: styles.actionsWrapper },
                    React.createElement(Button, { size: "md", icon: "plus-square", fill: "text", onClick: handleAddButton, "data-testid": "alert-rule-template-add-modal-button" }, Messages.alertRuleTemplate.addAction)),
                React.createElement(AddAlertRuleTemplateModal, { isVisible: addModalVisible, setVisible: setAddModalVisible, getAlertRuleTemplates: getAlertRuleTemplates }),
                React.createElement(Table, { showPagination: true, totalItems: totalItems, totalPages: totalPages, pageSize: pageSize, pageIndex: pageIndex, onPaginationChanged: handlePaginationChanged, data: data, columns: columns, pendingRequest: pendingRequest, emptyMessage: React.createElement(EmptyListCTA, { title: Messages.alertRuleTemplate.table.noCreated, buttonIcon: "bell", buttonTitle: Messages.alertRuleTemplate.table.newAlertRuleTemplate, onClick: handleAddButton }) })))));
};
export default AlertRuleTemplate;
//# sourceMappingURL=AlertRuleTemplate.js.map