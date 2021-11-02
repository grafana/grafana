import { __awaiter, __generator, __makeTemplateObject, __read } from "tslib";
import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { css, cx } from '@emotion/css';
import { stylesFactory, useTheme, TextArea, Button, IconButton } from '@grafana/ui';
import { getDataSourceSrv } from '@grafana/runtime';
import { createUrlFromRichHistory, createQueryText } from 'app/core/utils/richHistory';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { copyStringToClipboard } from 'app/core/utils/explore';
import appEvents from 'app/core/app_events';
import { dispatch } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { updateRichHistory } from '../state/history';
import { changeDatasource } from '../state/datasource';
import { setQueries } from '../state/query';
import { ShowConfirmModalEvent } from '../../../types/events';
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    var datasourceInstance = explore[exploreId].datasourceInstance;
    return {
        exploreId: exploreId,
        datasourceInstance: datasourceInstance,
    };
}
var mapDispatchToProps = {
    changeDatasource: changeDatasource,
    updateRichHistory: updateRichHistory,
    setQueries: setQueries,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var getStyles = stylesFactory(function (theme, isRemoved) {
    /* Hard-coded value so all buttons and icons on right side of card are aligned */
    var rigtColumnWidth = '240px';
    var rigtColumnContentWidth = '170px';
    /* If datasource was removed, card will have inactive color */
    var cardColor = theme.colors.bg2;
    return {
        queryCard: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      border: 1px solid ", ";\n      margin: ", " 0;\n      background-color: ", ";\n      border-radius: ", ";\n      .starred {\n        color: ", ";\n      }\n    "], ["\n      display: flex;\n      flex-direction: column;\n      border: 1px solid ", ";\n      margin: ", " 0;\n      background-color: ", ";\n      border-radius: ", ";\n      .starred {\n        color: ", ";\n      }\n    "])), theme.colors.border1, theme.spacing.sm, cardColor, theme.border.radius.sm, theme.palette.orange),
        cardRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      padding: ", ";\n      border-bottom: none;\n      :first-of-type {\n        border-bottom: 1px solid ", ";\n        padding: ", " ", ";\n      }\n      img {\n        height: ", ";\n        max-width: ", ";\n        margin-right: ", ";\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      padding: ", ";\n      border-bottom: none;\n      :first-of-type {\n        border-bottom: 1px solid ", ";\n        padding: ", " ", ";\n      }\n      img {\n        height: ", ";\n        max-width: ", ";\n        margin-right: ", ";\n      }\n    "])), theme.spacing.sm, theme.colors.border1, theme.spacing.xs, theme.spacing.sm, theme.typography.size.base, theme.typography.size.base, theme.spacing.sm),
        datasourceContainer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      font-size: ", ";\n      font-weight: ", ";\n    "], ["\n      display: flex;\n      align-items: center;\n      font-size: ", ";\n      font-weight: ", ";\n    "])), theme.typography.size.sm, theme.typography.weight.semibold),
        queryActionButtons: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      max-width: ", ";\n      display: flex;\n      justify-content: flex-end;\n      font-size: ", ";\n      button {\n        margin-left: ", ";\n      }\n    "], ["\n      max-width: ", ";\n      display: flex;\n      justify-content: flex-end;\n      font-size: ", ";\n      button {\n        margin-left: ", ";\n      }\n    "])), rigtColumnContentWidth, theme.typography.size.base, theme.spacing.sm),
        queryContainer: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      font-weight: ", ";\n      width: calc(100% - ", ");\n    "], ["\n      font-weight: ", ";\n      width: calc(100% - ", ");\n    "])), theme.typography.weight.semibold, rigtColumnWidth),
        queryRow: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      border-top: 1px solid ", ";\n      word-break: break-all;\n      padding: 4px 2px;\n      :first-child {\n        border-top: none;\n        padding: 0 0 4px 0;\n      }\n    "], ["\n      border-top: 1px solid ", ";\n      word-break: break-all;\n      padding: 4px 2px;\n      :first-child {\n        border-top: none;\n        padding: 0 0 4px 0;\n      }\n    "])), theme.colors.border1),
        updateCommentContainer: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      width: calc(100% + ", ");\n      margin-top: ", ";\n    "], ["\n      width: calc(100% + ", ");\n      margin-top: ", ";\n    "])), rigtColumnWidth, theme.spacing.sm),
        comment: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      overflow-wrap: break-word;\n      font-size: ", ";\n      font-weight: ", ";\n      margin-top: ", ";\n    "], ["\n      overflow-wrap: break-word;\n      font-size: ", ";\n      font-weight: ", ";\n      margin-top: ", ";\n    "])), theme.typography.size.sm, theme.typography.weight.regular, theme.spacing.xs),
        commentButtonRow: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      > * {\n        margin-right: ", ";\n      }\n    "], ["\n      > * {\n        margin-right: ", ";\n      }\n    "])), theme.spacing.sm),
        textArea: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      width: 100%;\n    "], ["\n      width: 100%;\n    "]))),
        runButton: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n      max-width: ", ";\n      display: flex;\n      justify-content: flex-end;\n      button {\n        height: auto;\n        padding: ", " ", ";\n        line-height: 1.4;\n        span {\n          white-space: normal !important;\n        }\n      }\n    "], ["\n      max-width: ", ";\n      display: flex;\n      justify-content: flex-end;\n      button {\n        height: auto;\n        padding: ", " ", ";\n        line-height: 1.4;\n        span {\n          white-space: normal !important;\n        }\n      }\n    "])), rigtColumnContentWidth, theme.spacing.xs, theme.spacing.md),
    };
});
export function RichHistoryCard(props) {
    var _this = this;
    var _a;
    var query = props.query, dsImg = props.dsImg, isRemoved = props.isRemoved, updateRichHistory = props.updateRichHistory, changeDatasource = props.changeDatasource, exploreId = props.exploreId, datasourceInstance = props.datasourceInstance, setQueries = props.setQueries;
    var _b = __read(useState(false), 2), activeUpdateComment = _b[0], setActiveUpdateComment = _b[1];
    var _c = __read(useState(query.comment), 2), comment = _c[0], setComment = _c[1];
    var _d = __read(useState(undefined), 2), queryDsInstance = _d[0], setQueryDsInstance = _d[1];
    useEffect(function () {
        var getQueryDsInstance = function () { return __awaiter(_this, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getDataSourceSrv().get(query.datasourceName)];
                    case 1:
                        ds = _a.sent();
                        setQueryDsInstance(ds);
                        return [2 /*return*/];
                }
            });
        }); };
        getQueryDsInstance();
    }, [query.datasourceName]);
    var theme = useTheme();
    var styles = getStyles(theme, isRemoved);
    var onRunQuery = function () { return __awaiter(_this, void 0, void 0, function () {
        var queriesToRun;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queriesToRun = query.queries;
                    if (!(query.datasourceName !== (datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.name))) return [3 /*break*/, 2];
                    return [4 /*yield*/, changeDatasource(exploreId, query.datasourceName, { importQueries: true })];
                case 1:
                    _a.sent();
                    setQueries(exploreId, queriesToRun);
                    return [3 /*break*/, 3];
                case 2:
                    setQueries(exploreId, queriesToRun);
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var onCopyQuery = function () {
        var queriesToCopy = query.queries.map(function (q) { return createQueryText(q, queryDsInstance); }).join('\n');
        copyStringToClipboard(queriesToCopy);
        dispatch(notifyApp(createSuccessNotification('Query copied to clipboard')));
    };
    var onCreateShortLink = function () { return __awaiter(_this, void 0, void 0, function () {
        var link;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    link = createUrlFromRichHistory(query);
                    return [4 /*yield*/, createAndCopyShortLink(link)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var onDeleteQuery = function () {
        // For starred queries, we want confirmation. For non-starred, we don't.
        if (query.starred) {
            appEvents.publish(new ShowConfirmModalEvent({
                title: 'Delete',
                text: 'Are you sure you want to permanently delete your starred query?',
                yesText: 'Delete',
                icon: 'trash-alt',
                onConfirm: function () {
                    updateRichHistory(query.ts, 'delete');
                    dispatch(notifyApp(createSuccessNotification('Query deleted')));
                },
            }));
        }
        else {
            updateRichHistory(query.ts, 'delete');
            dispatch(notifyApp(createSuccessNotification('Query deleted')));
        }
    };
    var onStarrQuery = function () {
        updateRichHistory(query.ts, 'starred');
    };
    var toggleActiveUpdateComment = function () { return setActiveUpdateComment(!activeUpdateComment); };
    var onUpdateComment = function () {
        updateRichHistory(query.ts, 'comment', comment);
        setActiveUpdateComment(false);
    };
    var onCancelUpdateComment = function () {
        setActiveUpdateComment(false);
        setComment(query.comment);
    };
    var onKeyDown = function (keyEvent) {
        if (keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
            onUpdateComment();
        }
        if (keyEvent.key === 'Escape') {
            onCancelUpdateComment();
        }
    };
    var updateComment = (React.createElement("div", { className: styles.updateCommentContainer, "aria-label": comment ? 'Update comment form' : 'Add comment form' },
        React.createElement(TextArea, { value: comment, placeholder: comment ? undefined : 'An optional description of what the query does.', onChange: function (e) { return setComment(e.currentTarget.value); }, className: styles.textArea }),
        React.createElement("div", { className: styles.commentButtonRow },
            React.createElement(Button, { onClick: onUpdateComment, "aria-label": "Submit button" }, "Save comment"),
            React.createElement(Button, { variant: "secondary", onClick: onCancelUpdateComment }, "Cancel"))));
    var queryActionButtons = (React.createElement("div", { className: styles.queryActionButtons },
        React.createElement(IconButton, { name: "comment-alt", onClick: toggleActiveUpdateComment, title: ((_a = query.comment) === null || _a === void 0 ? void 0 : _a.length) > 0 ? 'Edit comment' : 'Add comment' }),
        React.createElement(IconButton, { name: "copy", onClick: onCopyQuery, title: "Copy query to clipboard" }),
        !isRemoved && (React.createElement(IconButton, { name: "share-alt", onClick: onCreateShortLink, title: "Copy shortened link to clipboard" })),
        React.createElement(IconButton, { name: "trash-alt", title: 'Delete query', onClick: onDeleteQuery }),
        React.createElement(IconButton, { name: query.starred ? 'favorite' : 'star', iconType: query.starred ? 'mono' : 'default', onClick: onStarrQuery, title: query.starred ? 'Unstar query' : 'Star query' })));
    return (React.createElement("div", { className: styles.queryCard, onKeyDown: onKeyDown },
        React.createElement("div", { className: styles.cardRow },
            React.createElement("div", { className: styles.datasourceContainer },
                React.createElement("img", { src: dsImg, "aria-label": "Data source icon" }),
                React.createElement("div", { "aria-label": "Data source name" }, isRemoved ? 'Data source does not exist anymore' : query.datasourceName)),
            queryActionButtons),
        React.createElement("div", { className: cx(styles.cardRow) },
            React.createElement("div", { className: styles.queryContainer },
                query.queries.map(function (q, i) {
                    var queryText = createQueryText(q, queryDsInstance);
                    return (React.createElement("div", { "aria-label": "Query text", key: q + "-" + i, className: styles.queryRow }, queryText));
                }),
                !activeUpdateComment && query.comment && (React.createElement("div", { "aria-label": "Query comment", className: styles.comment }, query.comment)),
                activeUpdateComment && updateComment),
            !activeUpdateComment && (React.createElement("div", { className: styles.runButton },
                React.createElement(Button, { variant: "secondary", onClick: onRunQuery, disabled: isRemoved }, (datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.name) === query.datasourceName ? 'Run query' : 'Switch data source and run query'))))));
}
export default connector(RichHistoryCard);
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11;
//# sourceMappingURL=RichHistoryCard.js.map