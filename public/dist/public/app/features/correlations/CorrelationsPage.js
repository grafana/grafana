import { __awaiter, __rest } from "tslib";
import { css } from '@emotion/css';
import { negate } from 'lodash';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isFetchError, reportInteraction } from '@grafana/runtime';
import { Badge, Button, DeleteButton, LoadingPlaceholder, useStyles2, Alert, InteractiveTable, Pagination, Icon, } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { Trans, t } from 'app/core/internationalization';
import { AccessControlAction } from 'app/types';
import { AddCorrelationForm } from './Forms/AddCorrelationForm';
import { EditCorrelationForm } from './Forms/EditCorrelationForm';
import { EmptyCorrelationsCTA } from './components/EmptyCorrelationsCTA';
import { useCorrelations } from './useCorrelations';
const sortDatasource = (a, b, column) => a.values[column].name.localeCompare(b.values[column].name);
const isCorrelationsReadOnly = (correlation) => correlation.provisioned;
const loaderWrapper = css `
  display: flex;
  justify-content: center;
`;
export default function CorrelationsPage() {
    var _a, _b;
    const navModel = useNavModel('correlations');
    const [isAdding, setIsAddingValue] = useState(false);
    const page = useRef(1);
    const setIsAdding = (value) => {
        setIsAddingValue(value);
        if (value) {
            reportInteraction('grafana_correlations_adding_started');
        }
    };
    const _c = useCorrelations(), { remove } = _c, _d = _c.get, { execute: fetchCorrelations } = _d, get = __rest(_d, ["execute"]);
    const canWriteCorrelations = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
    const handleAdded = useCallback(() => {
        reportInteraction('grafana_correlations_added');
        fetchCorrelations({ page: page.current });
        setIsAdding(false);
    }, [fetchCorrelations]);
    const handleUpdated = useCallback(() => {
        reportInteraction('grafana_correlations_edited');
        fetchCorrelations({ page: page.current });
    }, [fetchCorrelations]);
    const handleDelete = useCallback((params, isLastRow) => __awaiter(this, void 0, void 0, function* () {
        yield remove.execute(params);
        reportInteraction('grafana_correlations_deleted');
        if (isLastRow) {
            page.current--;
        }
        fetchCorrelations({ page: page.current });
    }), [remove, fetchCorrelations]);
    useEffect(() => {
        fetchCorrelations({ page: page.current });
    }, [fetchCorrelations]);
    const RowActions = useCallback(({ row: { index, original: { source: { uid: sourceUID }, provisioned, uid, }, }, }) => {
        return (!provisioned && (React.createElement(DeleteButton, { "aria-label": t('correlations.list.delete', 'delete correlation'), onConfirm: () => handleDelete({ sourceUID, uid }, page.current > 1 && index === 0 && (data === null || data === void 0 ? void 0 : data.correlations.length) === 1), closeOnConfirm: true })));
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleDelete]);
    const columns = useMemo(() => [
        {
            id: 'info',
            cell: InfoCell,
            disableGrow: true,
            visible: (data) => data.some(isCorrelationsReadOnly),
        },
        {
            id: 'source',
            header: t('correlations.list.source', 'Source'),
            cell: DataSourceCell,
            sortType: sortDatasource,
        },
        {
            id: 'target',
            header: t('correlations.list.target', 'Target'),
            cell: DataSourceCell,
            sortType: sortDatasource,
        },
        { id: 'label', header: t('correlations.list.label', 'Label'), sortType: 'alphanumeric' },
        {
            id: 'actions',
            cell: RowActions,
            disableGrow: true,
            visible: (data) => canWriteCorrelations && data.some(negate(isCorrelationsReadOnly)),
        },
    ], [RowActions, canWriteCorrelations]);
    const data = useMemo(() => get.value, [get.value]);
    const showEmptyListCTA = (data === null || data === void 0 ? void 0 : data.correlations.length) === 0 && !isAdding && !get.error;
    const addButton = canWriteCorrelations && ((_a = data === null || data === void 0 ? void 0 : data.correlations) === null || _a === void 0 ? void 0 : _a.length) !== 0 && data !== undefined && !isAdding && (React.createElement(Button, { icon: "plus", onClick: () => setIsAdding(true) },
        React.createElement(Trans, { i18nKey: "correlations.add-new" }, "Add new")));
    return (React.createElement(Page, { navModel: navModel, subTitle: React.createElement(React.Fragment, null,
            React.createElement(Trans, { i18nKey: "correlations.sub-title" },
                "Define how data living in different data sources relates to each other. Read more in the",
                ' ',
                React.createElement("a", { href: "https://grafana.com/docs/grafana/next/administration/correlations/", target: "_blank", rel: "noreferrer" },
                    "documentation",
                    React.createElement(Icon, { name: "external-link-alt" })))), actions: addButton },
        React.createElement(Page.Contents, null,
            React.createElement("div", null,
                !data && get.loading && (React.createElement("div", { className: loaderWrapper },
                    React.createElement(LoadingPlaceholder, { text: t('correlations.list.loading', 'loading...') }))),
                showEmptyListCTA && (React.createElement(EmptyCorrelationsCTA, { canWriteCorrelations: canWriteCorrelations, onClick: () => setIsAdding(true) })),
                // This error is not actionable, it'd be nice to have a recovery button
                get.error && (React.createElement(Alert, { severity: "error", title: t('correlations.alert.title', 'Error fetching correlation data'), topSpacing: 2 }, (isFetchError(get.error) && ((_b = get.error.data) === null || _b === void 0 ? void 0 : _b.message)) ||
                    t('correlations.alert.error-message', 'An unknown error occurred while fetching correlation data. Please try again.'))),
                isAdding && React.createElement(AddCorrelationForm, { onClose: () => setIsAdding(false), onCreated: handleAdded }),
                data && data.correlations.length >= 1 && (React.createElement(React.Fragment, null,
                    React.createElement(InteractiveTable, { renderExpandedRow: (correlation) => (React.createElement(ExpendedRow, { correlation: correlation, onUpdated: handleUpdated, readOnly: isCorrelationsReadOnly(correlation) || !canWriteCorrelations })), columns: columns, data: data.correlations, getRowId: (correlation) => `${correlation.source.uid}-${correlation.uid}` }),
                    React.createElement(Pagination, { currentPage: page.current, numberOfPages: Math.ceil(data.totalCount / data.limit), onNavigate: (toPage) => {
                            fetchCorrelations({ page: (page.current = toPage) });
                        } })))))));
}
function ExpendedRow(_a) {
    var _b = _a.correlation, { source, target } = _b, correlation = __rest(_b, ["source", "target"]), { readOnly, onUpdated } = _a;
    useEffect(() => reportInteraction('grafana_correlations_details_expanded'), 
    // we only want to fire this on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);
    return (React.createElement(EditCorrelationForm, { correlation: Object.assign(Object.assign({}, correlation), { sourceUID: source.uid, targetUID: target.uid }), onUpdated: onUpdated, readOnly: readOnly }));
}
const getDatasourceCellStyles = (theme) => ({
    root: css `
    display: flex;
    align-items: center;
  `,
    dsLogo: css `
    margin-right: ${theme.spacing()};
    height: 16px;
    width: 16px;
  `,
});
const DataSourceCell = memo(function DataSourceCell({ cell: { value }, }) {
    const styles = useStyles2(getDatasourceCellStyles);
    return (React.createElement("span", { className: styles.root },
        React.createElement("img", { src: value.meta.info.logos.small, alt: "", className: styles.dsLogo }),
        value.name));
}, ({ cell: { value } }, { cell: { value: prevValue } }) => {
    return value.type === prevValue.type && value.name === prevValue.name;
});
const noWrap = css `
  white-space: nowrap;
`;
const InfoCell = memo(function InfoCell(_a) {
    var props = __rest(_a, []);
    const readOnly = props.row.original.provisioned;
    if (readOnly) {
        return React.createElement(Badge, { text: t('correlations.list.read-only', 'Read only'), color: "purple", className: noWrap });
    }
    else {
        return null;
    }
}, (props, prevProps) => props.row.original.source.readOnly === prevProps.row.original.source.readOnly);
//# sourceMappingURL=CorrelationsPage.js.map