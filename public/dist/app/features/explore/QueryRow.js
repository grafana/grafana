import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
// Components
import QueryEditor from './QueryEditor';
import QueryTransactionStatus from './QueryTransactionStatus';
// Actions
import { changeQuery, modifyQueries, runQueries, addQueryRow } from './state/actions';
import { highlightLogsExpressionAction, removeQueryRowAction } from './state/actionTypes';
function getFirstHintFromTransactions(transactions) {
    var transaction = transactions.find(function (qt) { return qt.hints && qt.hints.length > 0; });
    if (transaction) {
        return transaction.hints[0];
    }
    return undefined;
}
var QueryRow = /** @class */ (function (_super) {
    tslib_1.__extends(QueryRow, _super);
    function QueryRow() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onExecuteQuery = function () {
            var exploreId = _this.props.exploreId;
            _this.props.runQueries(exploreId);
        };
        _this.onChangeQuery = function (query, override) {
            var _a = _this.props, datasourceInstance = _a.datasourceInstance, exploreId = _a.exploreId, index = _a.index;
            _this.props.changeQuery(exploreId, query, index, override);
            if (query && !override && datasourceInstance.getHighlighterExpression && index === 0) {
                // Live preview of log search matches. Only use on first row for now
                _this.updateLogsHighlights(query);
            }
        };
        _this.onClickAddButton = function () {
            var _a = _this.props, exploreId = _a.exploreId, index = _a.index;
            _this.props.addQueryRow(exploreId, index);
        };
        _this.onClickClearButton = function () {
            _this.onChangeQuery(null, true);
        };
        _this.onClickHintFix = function (action) {
            var _a = _this.props, datasourceInstance = _a.datasourceInstance, exploreId = _a.exploreId, index = _a.index;
            if (datasourceInstance && datasourceInstance.modifyQuery) {
                var modifier = function (queries, action) { return datasourceInstance.modifyQuery(queries, action); };
                _this.props.modifyQueries(exploreId, action, index, modifier);
            }
        };
        _this.onClickRemoveButton = function () {
            var _a = _this.props, exploreId = _a.exploreId, index = _a.index;
            _this.props.removeQueryRowAction({ exploreId: exploreId, index: index });
        };
        _this.updateLogsHighlights = _.debounce(function (value) {
            var datasourceInstance = _this.props.datasourceInstance;
            if (datasourceInstance.getHighlighterExpression) {
                var exploreId = _this.props.exploreId;
                var expressions = [datasourceInstance.getHighlighterExpression(value)];
                _this.props.highlightLogsExpressionAction({ exploreId: exploreId, expressions: expressions });
            }
        }, 500);
        return _this;
    }
    QueryRow.prototype.componentWillUnmount = function () {
        console.log('QueryRow will unmount');
    };
    QueryRow.prototype.render = function () {
        var _a = this.props, datasourceInstance = _a.datasourceInstance, history = _a.history, index = _a.index, query = _a.query, queryTransactions = _a.queryTransactions, exploreEvents = _a.exploreEvents, range = _a.range;
        var transactions = queryTransactions.filter(function (t) { return t.rowIndex === index; });
        var transactionWithError = transactions.find(function (t) { return t.error !== undefined; });
        var hint = getFirstHintFromTransactions(transactions);
        var queryError = transactionWithError ? transactionWithError.error : null;
        var QueryField = datasourceInstance.pluginExports.ExploreQueryField;
        return (React.createElement("div", { className: "query-row" },
            React.createElement("div", { className: "query-row-status" },
                React.createElement(QueryTransactionStatus, { transactions: transactions })),
            React.createElement("div", { className: "query-row-field flex-shrink-1" }, QueryField ? (React.createElement(QueryField, { datasource: datasourceInstance, query: query, error: queryError, hint: hint, history: history, onExecuteQuery: this.onExecuteQuery, onExecuteHint: this.onClickHintFix, onQueryChange: this.onChangeQuery })) : (React.createElement(QueryEditor, { datasource: datasourceInstance, error: queryError, onQueryChange: this.onChangeQuery, onExecuteQuery: this.onExecuteQuery, initialQuery: query, exploreEvents: exploreEvents, range: range }))),
            React.createElement("div", { className: "gf-form-inline flex-shrink-0" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("button", { className: "gf-form-label gf-form-label--btn", onClick: this.onClickClearButton },
                        React.createElement("i", { className: "fa fa-times" }))),
                React.createElement("div", { className: "gf-form" },
                    React.createElement("button", { className: "gf-form-label gf-form-label--btn", onClick: this.onClickAddButton },
                        React.createElement("i", { className: "fa fa-plus" }))),
                React.createElement("div", { className: "gf-form" },
                    React.createElement("button", { className: "gf-form-label gf-form-label--btn", onClick: this.onClickRemoveButton },
                        React.createElement("i", { className: "fa fa-minus" }))))));
    };
    return QueryRow;
}(PureComponent));
export { QueryRow };
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId, index = _a.index;
    var explore = state.explore;
    var item = explore[exploreId];
    var datasourceInstance = item.datasourceInstance, history = item.history, queries = item.queries, queryTransactions = item.queryTransactions, range = item.range;
    var query = queries[index];
    return { datasourceInstance: datasourceInstance, history: history, query: query, queryTransactions: queryTransactions, range: range };
}
var mapDispatchToProps = {
    addQueryRow: addQueryRow,
    changeQuery: changeQuery,
    highlightLogsExpressionAction: highlightLogsExpressionAction,
    modifyQueries: modifyQueries,
    removeQueryRowAction: removeQueryRowAction,
    runQueries: runQueries,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(QueryRow));
//# sourceMappingURL=QueryRow.js.map