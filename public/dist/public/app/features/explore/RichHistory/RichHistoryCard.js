import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { connect } from 'react-redux';
import { useAsync } from 'react-use';
import { config, getDataSourceSrv, reportInteraction, getAppEvents } from '@grafana/runtime';
import { TextArea, Button, IconButton, useStyles2, LoadingPlaceholder } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { copyStringToClipboard } from 'app/core/utils/explore';
import { createUrlFromRichHistory, createQueryText } from 'app/core/utils/richHistory';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { changeDatasource } from 'app/features/explore/state/datasource';
import { starHistoryItem, commentHistoryItem, deleteHistoryItem } from 'app/features/explore/state/history';
import { setQueries } from 'app/features/explore/state/query';
import { dispatch } from 'app/store/store';
import { ShowConfirmModalEvent } from 'app/types/events';
function mapStateToProps(state, { exploreId }) {
    const explore = state.explore;
    const { datasourceInstance } = explore.panes[exploreId];
    return {
        exploreId,
        datasourceInstance,
    };
}
const mapDispatchToProps = {
    changeDatasource,
    deleteHistoryItem,
    commentHistoryItem,
    starHistoryItem,
    setQueries,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
const getStyles = (theme) => {
    /* Hard-coded value so all buttons and icons on right side of card are aligned */
    const rightColumnWidth = '240px';
    const rightColumnContentWidth = '170px';
    /* If datasource was removed, card will have inactive color */
    const cardColor = theme.colors.background.secondary;
    return {
        queryCard: css `
      position: relative;
      display: flex;
      flex-direction: column;
      border: 1px solid ${theme.colors.border.weak};
      margin: ${theme.spacing(1)} 0;
      background-color: ${cardColor};
      border-radius: ${theme.shape.radius.default};
      .starred {
        color: ${theme.v1.palette.orange};
      }
    `,
        cardRow: css `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.spacing(1)};
      border-bottom: none;
      :first-of-type {
        border-bottom: 1px solid ${theme.colors.border.weak};
        padding: ${theme.spacing(0.5, 1)};
      }
      img {
        height: ${theme.typography.fontSize}px;
        max-width: ${theme.typography.fontSize}px;
        margin-right: ${theme.spacing(1)};
      }
    `,
        queryActionButtons: css `
      max-width: ${rightColumnContentWidth};
      display: flex;
      justify-content: flex-end;
      font-size: ${theme.typography.size.base};
      button {
        margin-left: ${theme.spacing(1)};
      }
    `,
        queryContainer: css `
      font-weight: ${theme.typography.fontWeightMedium};
      width: calc(100% - ${rightColumnWidth});
    `,
        updateCommentContainer: css `
      width: calc(100% + ${rightColumnWidth});
      margin-top: ${theme.spacing(1)};
    `,
        comment: css `
      overflow-wrap: break-word;
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightRegular};
      margin-top: ${theme.spacing(0.5)};
    `,
        commentButtonRow: css `
      > * {
        margin-top: ${theme.spacing(1)};
        margin-right: ${theme.spacing(1)};
      }
    `,
        textArea: css `
      width: 100%;
    `,
        runButton: css `
      max-width: ${rightColumnContentWidth};
      display: flex;
      justify-content: flex-end;
      button {
        height: auto;
        padding: ${theme.spacing(0.5, 2)};
        line-height: 1.4;
        span {
          white-space: normal !important;
        }
      }
    `,
        loader: css `
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: ${theme.colors.background.secondary};
    `,
    };
};
export function RichHistoryCard(props) {
    var _a;
    const { query, commentHistoryItem, starHistoryItem, deleteHistoryItem, changeDatasource, exploreId, datasourceInstance, setQueries, } = props;
    const [activeUpdateComment, setActiveUpdateComment] = useState(false);
    const [comment, setComment] = useState(query.comment);
    const { value, loading } = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        let dsInstance;
        try {
            dsInstance = yield getDataSourceSrv().get(query.datasourceUid);
        }
        catch (e) { }
        return {
            dsInstance,
            queries: yield Promise.all(query.queries.map((query) => __awaiter(this, void 0, void 0, function* () {
                let datasource;
                if (dsInstance === null || dsInstance === void 0 ? void 0 : dsInstance.meta.mixed) {
                    try {
                        datasource = yield getDataSourceSrv().get(query.datasource);
                    }
                    catch (e) { }
                }
                else {
                    datasource = dsInstance;
                }
                return {
                    query,
                    datasource,
                };
            }))),
        };
    }), [query.datasourceUid, query.queries]);
    const styles = useStyles2(getStyles);
    const onRunQuery = () => __awaiter(this, void 0, void 0, function* () {
        const queriesToRun = query.queries;
        const differentDataSource = query.datasourceUid !== (datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.uid);
        if (differentDataSource) {
            yield changeDatasource(exploreId, query.datasourceUid);
        }
        setQueries(exploreId, queriesToRun);
        reportInteraction('grafana_explore_query_history_run', {
            queryHistoryEnabled: config.queryHistoryEnabled,
            differentDataSource,
        });
    });
    const onCopyQuery = () => __awaiter(this, void 0, void 0, function* () {
        var _b;
        const datasources = [...query.queries.map((q) => { var _a; return ((_a = q.datasource) === null || _a === void 0 ? void 0 : _a.type) || 'unknown'; })];
        reportInteraction('grafana_explore_query_history_copy_query', {
            datasources,
            mixed: Boolean((_b = value === null || value === void 0 ? void 0 : value.dsInstance) === null || _b === void 0 ? void 0 : _b.meta.mixed),
        });
        if (loading || !value) {
            return;
        }
        const queriesText = value.queries
            .map((q) => {
            return createQueryText(q.query, q.datasource);
        })
            .join('\n');
        copyStringToClipboard(queriesText);
        dispatch(notifyApp(createSuccessNotification('Query copied to clipboard')));
    });
    const onCreateShortLink = () => __awaiter(this, void 0, void 0, function* () {
        const link = createUrlFromRichHistory(query);
        yield createAndCopyShortLink(link);
    });
    const onDeleteQuery = () => {
        const performDelete = (queryId) => {
            deleteHistoryItem(queryId);
            dispatch(notifyApp(createSuccessNotification('Query deleted')));
            reportInteraction('grafana_explore_query_history_deleted', {
                queryHistoryEnabled: config.queryHistoryEnabled,
            });
        };
        // For starred queries, we want confirmation. For non-starred, we don't.
        if (query.starred) {
            getAppEvents().publish(new ShowConfirmModalEvent({
                title: 'Delete',
                text: 'Are you sure you want to permanently delete your starred query?',
                yesText: 'Delete',
                icon: 'trash-alt',
                onConfirm: () => performDelete(query.id),
            }));
        }
        else {
            performDelete(query.id);
        }
    };
    const onStarrQuery = () => {
        starHistoryItem(query.id, !query.starred);
        reportInteraction('grafana_explore_query_history_starred', {
            queryHistoryEnabled: config.queryHistoryEnabled,
            newValue: !query.starred,
        });
    };
    const toggleActiveUpdateComment = () => setActiveUpdateComment(!activeUpdateComment);
    const onUpdateComment = () => {
        commentHistoryItem(query.id, comment);
        setActiveUpdateComment(false);
        reportInteraction('grafana_explore_query_history_commented', {
            queryHistoryEnabled: config.queryHistoryEnabled,
        });
    };
    const onCancelUpdateComment = () => {
        setActiveUpdateComment(false);
        setComment(query.comment);
    };
    const onKeyDown = (keyEvent) => {
        if (keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
            onUpdateComment();
        }
        if (keyEvent.key === 'Escape') {
            onCancelUpdateComment();
        }
    };
    const updateComment = (React.createElement("div", { className: styles.updateCommentContainer, "aria-label": comment ? 'Update comment form' : 'Add comment form' },
        React.createElement(TextArea, { onKeyDown: onKeyDown, value: comment, placeholder: comment ? undefined : 'An optional description of what the query does.', onChange: (e) => setComment(e.currentTarget.value), className: styles.textArea }),
        React.createElement("div", { className: styles.commentButtonRow },
            React.createElement(Button, { onClick: onUpdateComment }, "Save comment"),
            React.createElement(Button, { variant: "secondary", onClick: onCancelUpdateComment }, "Cancel"))));
    const queryActionButtons = (React.createElement("div", { className: styles.queryActionButtons },
        React.createElement(IconButton, { name: "comment-alt", onClick: toggleActiveUpdateComment, tooltip: ((_a = query.comment) === null || _a === void 0 ? void 0 : _a.length) > 0 ? 'Edit comment' : 'Add comment' }),
        React.createElement(IconButton, { name: "copy", onClick: onCopyQuery, tooltip: "Copy query to clipboard" }),
        (value === null || value === void 0 ? void 0 : value.dsInstance) && (React.createElement(IconButton, { name: "share-alt", onClick: onCreateShortLink, tooltip: "Copy shortened link to clipboard" })),
        React.createElement(IconButton, { name: "trash-alt", title: "Delete query", tooltip: "Delete query", onClick: onDeleteQuery }),
        React.createElement(IconButton, { name: query.starred ? 'favorite' : 'star', iconType: query.starred ? 'mono' : 'default', onClick: onStarrQuery, tooltip: query.starred ? 'Unstar query' : 'Star query' })));
    return (React.createElement("div", { className: styles.queryCard },
        React.createElement("div", { className: styles.cardRow },
            React.createElement(DatasourceInfo, { dsApi: value === null || value === void 0 ? void 0 : value.dsInstance, size: "sm" }),
            queryActionButtons),
        React.createElement("div", { className: cx(styles.cardRow) },
            React.createElement("div", { className: styles.queryContainer }, value === null || value === void 0 ? void 0 :
                value.queries.map((q, i) => {
                    var _a;
                    return React.createElement(Query, { query: q, key: `${q}-${i}`, showDsInfo: (_a = value === null || value === void 0 ? void 0 : value.dsInstance) === null || _a === void 0 ? void 0 : _a.meta.mixed });
                }),
                !activeUpdateComment && query.comment && (React.createElement("div", { "aria-label": "Query comment", className: styles.comment }, query.comment)),
                activeUpdateComment && updateComment),
            !activeUpdateComment && (React.createElement("div", { className: styles.runButton },
                React.createElement(Button, { variant: "secondary", onClick: onRunQuery, disabled: !(value === null || value === void 0 ? void 0 : value.dsInstance) || value.queries.some((query) => !query.datasource) }, (datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.uid) === query.datasourceUid ? 'Run query' : 'Switch data source and run query')))),
        loading && React.createElement(LoadingPlaceholder, { text: "loading...", className: styles.loader })));
}
const getQueryStyles = (theme) => ({
    queryRow: css `
    border-top: 1px solid ${theme.colors.border.weak};
    display: flex;
    flex-direction: row;
    padding: 4px 0px;
    gap: 4px;
    :first-child {
      border-top: none;
    }
  `,
    dsInfoContainer: css `
    display: flex;
    align-items: center;
  `,
    queryText: css `
    word-break: break-all;
  `,
});
const Query = ({ query, showDsInfo = false }) => {
    const styles = useStyles2(getQueryStyles);
    return (React.createElement("div", { className: styles.queryRow },
        showDsInfo && (React.createElement("div", { className: styles.dsInfoContainer },
            React.createElement(DatasourceInfo, { dsApi: query.datasource, size: "md" }),
            ': ')),
        React.createElement("span", { "aria-label": "Query text", className: styles.queryText }, createQueryText(query.query, query.datasource))));
};
const getDsInfoStyles = (size) => (theme) => css `
  display: flex;
  align-items: center;
  font-size: ${theme.typography[size === 'sm' ? 'bodySmall' : 'body'].fontSize};
  font-weight: ${theme.typography.fontWeightMedium};
  white-space: nowrap;
`;
function DatasourceInfo({ dsApi, size }) {
    const getStyles = useCallback((theme) => getDsInfoStyles(size)(theme), [size]);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles },
        React.createElement("img", { src: (dsApi === null || dsApi === void 0 ? void 0 : dsApi.meta.info.logos.small) || 'public/img/icn-datasource.svg', alt: (dsApi === null || dsApi === void 0 ? void 0 : dsApi.type) || 'Data source does not exist anymore', "aria-label": "Data source icon" }),
        React.createElement("div", { "aria-label": "Data source name" }, (dsApi === null || dsApi === void 0 ? void 0 : dsApi.name) || 'Data source does not exist anymore')));
}
export default connector(RichHistoryCard);
//# sourceMappingURL=RichHistoryCard.js.map