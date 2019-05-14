import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import ElapsedTime from './ElapsedTime';
function formatLatency(value) {
    return (value / 1000).toFixed(1) + "s";
}
var QueryTransactionStatusItem = /** @class */ (function (_super) {
    tslib_1.__extends(QueryTransactionStatusItem, _super);
    function QueryTransactionStatusItem() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    QueryTransactionStatusItem.prototype.render = function () {
        var transaction = this.props.transaction;
        var className = transaction.done ? 'query-transaction' : 'query-transaction query-transaction--loading';
        return (React.createElement("div", { className: className },
            React.createElement("div", { className: "query-transaction__type" },
                transaction.resultType,
                ":"),
            React.createElement("div", { className: "query-transaction__duration" }, transaction.done ? formatLatency(transaction.latency) : React.createElement(ElapsedTime, null))));
    };
    return QueryTransactionStatusItem;
}(PureComponent));
var QueryTransactionStatus = /** @class */ (function (_super) {
    tslib_1.__extends(QueryTransactionStatus, _super);
    function QueryTransactionStatus() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    QueryTransactionStatus.prototype.render = function () {
        var transactions = this.props.transactions;
        return (React.createElement("div", { className: "query-transactions" }, transactions.map(function (t, i) { return (React.createElement(QueryTransactionStatusItem, { key: t.rowIndex + ":" + t.resultType, transaction: t })); })));
    };
    return QueryTransactionStatus;
}(PureComponent));
export default QueryTransactionStatus;
//# sourceMappingURL=QueryTransactionStatus.js.map