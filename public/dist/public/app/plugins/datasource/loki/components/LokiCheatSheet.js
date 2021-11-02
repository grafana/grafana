import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { shuffle } from 'lodash';
var DEFAULT_EXAMPLES = ['{job="default/prometheus"}'];
var PREFERRED_LABELS = ['job', 'app', 'k8s_app'];
var EXAMPLES_LIMIT = 5;
var LOGQL_EXAMPLES = [
    {
        title: 'Log pipeline',
        expression: '{job="mysql"} |= "metrics" | logfmt | duration > 10s',
        label: 'This query targets the MySQL job, filters out logs that don’t contain the word "metrics" and parses each log line to extract more labels and filters with them.',
    },
    {
        title: 'Count over time',
        expression: 'count_over_time({job="mysql"}[5m])',
        label: 'This query counts all the log lines within the last five minutes for the MySQL job.',
    },
    {
        title: 'Rate',
        expression: 'rate(({job="mysql"} |= "error" != "timeout")[10s])',
        label: 'This query gets the per-second rate of all non-timeout errors within the last ten seconds for the MySQL job.',
    },
    {
        title: 'Aggregate, count, and group',
        expression: 'sum(count_over_time({job="mysql"}[5m])) by (level)',
        label: 'Get the count of logs during the last five minutes, grouping by level.',
    },
];
var LokiCheatSheet = /** @class */ (function (_super) {
    __extends(LokiCheatSheet, _super);
    function LokiCheatSheet() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            userExamples: [],
        };
        _this.checkUserLabels = function () { return __awaiter(_this, void 0, void 0, function () {
            var provider, labels_1, preferredLabel_1, values, userExamples;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        provider = (_a = this.props.datasource) === null || _a === void 0 ? void 0 : _a.languageProvider;
                        if (!provider.started) return [3 /*break*/, 3];
                        labels_1 = provider.getLabelKeys() || [];
                        preferredLabel_1 = PREFERRED_LABELS.find(function (l) { return labels_1.includes(l); });
                        if (!preferredLabel_1) return [3 /*break*/, 2];
                        return [4 /*yield*/, provider.getLabelValues(preferredLabel_1)];
                    case 1:
                        values = _b.sent();
                        userExamples = shuffle(values)
                            .slice(0, EXAMPLES_LIMIT)
                            .map(function (value) { return "{" + preferredLabel_1 + "=\"" + value + "\"}"; });
                        this.setState({ userExamples: userExamples });
                        _b.label = 2;
                    case 2: return [3 /*break*/, 4];
                    case 3:
                        this.scheduleUserLabelChecking();
                        _b.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        return _this;
    }
    LokiCheatSheet.prototype.componentDidMount = function () {
        this.scheduleUserLabelChecking();
    };
    LokiCheatSheet.prototype.componentWillUnmount = function () {
        clearTimeout(this.userLabelTimer);
    };
    LokiCheatSheet.prototype.scheduleUserLabelChecking = function () {
        this.userLabelTimer = setTimeout(this.checkUserLabels, 1000);
    };
    LokiCheatSheet.prototype.renderExpression = function (expr) {
        var onClickExample = this.props.onClickExample;
        return (React.createElement("div", { className: "cheat-sheet-item__example", key: expr, onClick: function (e) { return onClickExample({ refId: 'A', expr: expr }); } },
            React.createElement("code", null, expr)));
    };
    LokiCheatSheet.prototype.render = function () {
        var _this = this;
        var userExamples = this.state.userExamples;
        var hasUserExamples = userExamples.length > 0;
        return (React.createElement("div", null,
            React.createElement("h2", null, "Loki Cheat Sheet"),
            React.createElement("div", { className: "cheat-sheet-item" },
                React.createElement("div", { className: "cheat-sheet-item__title" }, "See your logs"),
                React.createElement("div", { className: "cheat-sheet-item__label" }, "Start by selecting a log stream from the Log browser, or alternatively you can write a stream selector into the query field."),
                hasUserExamples ? (React.createElement("div", null,
                    React.createElement("div", { className: "cheat-sheet-item__label" }, "Here are some example streams from your logs:"),
                    userExamples.map(function (example) { return _this.renderExpression(example); }))) : (React.createElement("div", null,
                    React.createElement("div", { className: "cheat-sheet-item__label" }, "Here is an example of a log stream:"),
                    this.renderExpression(DEFAULT_EXAMPLES[0])))),
            React.createElement("div", { className: "cheat-sheet-item" },
                React.createElement("div", { className: "cheat-sheet-item__title" }, "Combine stream selectors"),
                this.renderExpression('{app="cassandra",namespace="prod"}'),
                React.createElement("div", { className: "cheat-sheet-item__label" }, "Returns all log lines from streams that have both labels.")),
            React.createElement("div", { className: "cheat-sheet-item" },
                React.createElement("div", { className: "cheat-sheet-item__title" }, "Filtering for search terms."),
                this.renderExpression('{app="cassandra"} |~ "(duration|latency)s*(=|is|of)s*[d.]+"'),
                this.renderExpression('{app="cassandra"} |= "exact match"'),
                this.renderExpression('{app="cassandra"} != "do not match"'),
                React.createElement("div", { className: "cheat-sheet-item__label" },
                    React.createElement("a", { href: "https://grafana.com/docs/loki/latest/logql/#log-pipeline", target: "logql" }, "LogQL"),
                    ' ',
                    "supports exact and regular expression filters.")),
            LOGQL_EXAMPLES.map(function (item) { return (React.createElement("div", { className: "cheat-sheet-item", key: item.expression },
                React.createElement("div", { className: "cheat-sheet-item__title" }, item.title),
                _this.renderExpression(item.expression),
                React.createElement("div", { className: "cheat-sheet-item__label" }, item.label))); })));
    };
    return LokiCheatSheet;
}(PureComponent));
export default LokiCheatSheet;
//# sourceMappingURL=LokiCheatSheet.js.map