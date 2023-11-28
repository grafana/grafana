import { __awaiter } from "tslib";
import { shuffle } from 'lodash';
import React, { PureComponent } from 'react';
import { reportInteraction } from '@grafana/runtime';
const DEFAULT_EXAMPLES = ['{job="default/prometheus"}'];
const PREFERRED_LABELS = ['job', 'app', 'k8s_app'];
const EXAMPLES_LIMIT = 5;
const LOGQL_EXAMPLES = [
    {
        title: 'Log pipeline',
        expression: '{job="mysql"} |= "metrics" | logfmt | duration > 10s',
        label: 'This query targets the MySQL job, keeps logs that contain the substring "metrics", and then parses and filters the logs further.',
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
export default class LokiCheatSheet extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            userExamples: [],
        };
        this.checkUserLabels = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Set example from user labels
            const provider = (_a = this.props.datasource) === null || _a === void 0 ? void 0 : _a.languageProvider;
            if (provider.started) {
                const labels = provider.getLabelKeys() || [];
                const preferredLabel = PREFERRED_LABELS.find((l) => labels.includes(l));
                if (preferredLabel) {
                    const values = yield provider.getLabelValues(preferredLabel);
                    const userExamples = shuffle(values)
                        .slice(0, EXAMPLES_LIMIT)
                        .map((value) => `{${preferredLabel}="${value}"}`);
                    this.setState({ userExamples });
                }
            }
            else {
                this.scheduleUserLabelChecking();
            }
        });
    }
    componentDidMount() {
        this.scheduleUserLabelChecking();
        reportInteraction('grafana_loki_cheatsheet_opened', {});
    }
    componentWillUnmount() {
        clearTimeout(this.userLabelTimer);
    }
    scheduleUserLabelChecking() {
        this.userLabelTimer = setTimeout(this.checkUserLabels, 1000);
    }
    renderExpression(expr) {
        const { onClickExample } = this.props;
        const onClick = (query) => {
            onClickExample(query);
            reportInteraction('grafana_loki_cheatsheet_example_clicked', {});
        };
        return (React.createElement("button", { type: "button", className: "cheat-sheet-item__example", key: expr, onClick: (e) => onClick({ refId: 'A', expr }) },
            React.createElement("code", null, expr)));
    }
    render() {
        const { userExamples } = this.state;
        const hasUserExamples = userExamples.length > 0;
        return (React.createElement("div", null,
            React.createElement("h2", null, "Loki Cheat Sheet"),
            React.createElement("div", { className: "cheat-sheet-item" },
                React.createElement("div", { className: "cheat-sheet-item__title" }, "See your logs"),
                React.createElement("div", { className: "cheat-sheet-item__label" }, "Start by selecting a log stream from the Label browser, or alternatively you can write a stream selector into the query field."),
                hasUserExamples ? (React.createElement("div", null,
                    React.createElement("div", { className: "cheat-sheet-item__label" }, "Here are some example streams from your logs:"),
                    userExamples.map((example) => this.renderExpression(example)))) : (React.createElement("div", null,
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
            LOGQL_EXAMPLES.map((item) => (React.createElement("div", { className: "cheat-sheet-item", key: item.expression },
                React.createElement("div", { className: "cheat-sheet-item__title" }, item.title),
                this.renderExpression(item.expression),
                React.createElement("div", { className: "cheat-sheet-item__label" }, item.label))))));
    }
}
//# sourceMappingURL=LokiCheatSheet.js.map