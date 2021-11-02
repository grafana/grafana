import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { stripIndent, stripIndents } from 'common-tags';
import Prism from 'prismjs';
import tokenizer from '../syntax';
import { flattenTokens } from '@grafana/ui/src/slate-plugins/slate-prism';
import { css, cx } from '@emotion/css';
var CLIQ_EXAMPLES = [
    {
        category: 'Lambda',
        examples: [
            {
                title: 'View latency statistics for 5-minute intervals',
                expr: stripIndents(templateObject_1 || (templateObject_1 = __makeTemplateObject(["filter @type = \"REPORT\" |\n                           stats avg(@duration), max(@duration), min(@duration) by bin(5m)"], ["filter @type = \"REPORT\" |\n                           stats avg(@duration), max(@duration), min(@duration) by bin(5m)"]))),
            },
            {
                title: 'Determine the amount of overprovisioned memory',
                expr: stripIndent(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        filter @type = \"REPORT\" |\n        stats max(@memorySize / 1024 / 1024) as provisonedMemoryMB,\n              min(@maxMemoryUsed / 1024 / 1024) as smallestMemoryRequestMB,\n              avg(@maxMemoryUsed / 1024 / 1024) as avgMemoryUsedMB,\n              max(@maxMemoryUsed / 1024 / 1024) as maxMemoryUsedMB,\n              provisonedMemoryMB - maxMemoryUsedMB as overProvisionedMB"], ["\n        filter @type = \"REPORT\" |\n        stats max(@memorySize / 1024 / 1024) as provisonedMemoryMB,\n              min(@maxMemoryUsed / 1024 / 1024) as smallestMemoryRequestMB,\n              avg(@maxMemoryUsed / 1024 / 1024) as avgMemoryUsedMB,\n              max(@maxMemoryUsed / 1024 / 1024) as maxMemoryUsedMB,\n              provisonedMemoryMB - maxMemoryUsedMB as overProvisionedMB"]))),
            },
            {
                title: 'Find the most expensive requests',
                expr: stripIndents(templateObject_3 || (templateObject_3 = __makeTemplateObject(["filter @type = \"REPORT\" |\n                           fields @requestId, @billedDuration |\n                           sort by @billedDuration desc"], ["filter @type = \"REPORT\" |\n                           fields @requestId, @billedDuration |\n                           sort by @billedDuration desc"]))),
            },
        ],
    },
    {
        category: 'VPC Flow Logs',
        examples: [
            {
                title: 'Average, min, and max byte transfers by source and destination IP addresses',
                expr: "stats avg(bytes), min(bytes), max(bytes) by srcAddr, dstAddr",
            },
            {
                title: 'IP addresses using UDP transfer protocol',
                expr: 'filter protocol=17 | stats count(*) by srcAddr',
            },
            {
                title: 'Top 10 byte transfers by source and destination IP addresses',
                expr: stripIndents(templateObject_4 || (templateObject_4 = __makeTemplateObject(["stats sum(bytes) as bytesTransferred by srcAddr, dstAddr |\n                           sort bytesTransferred desc |\n                           limit 10"], ["stats sum(bytes) as bytesTransferred by srcAddr, dstAddr |\n                           sort bytesTransferred desc |\n                           limit 10"]))),
            },
            {
                title: 'Top 20 source IP addresses with highest number of rejected requests',
                expr: stripIndents(templateObject_5 || (templateObject_5 = __makeTemplateObject(["filter action=\"REJECT\" |\n                           stats count(*) as numRejections by srcAddr |\n                           sort numRejections desc |\n                           limit 20"], ["filter action=\"REJECT\" |\n                           stats count(*) as numRejections by srcAddr |\n                           sort numRejections desc |\n                           limit 20"]))),
            },
        ],
    },
    {
        category: 'CloudTrail',
        examples: [
            {
                title: 'Number of log entries by service, event type, and region',
                expr: 'stats count(*) by eventSource, eventName, awsRegion',
            },
            {
                title: 'Number of log entries by region and EC2 event type',
                expr: stripIndents(templateObject_6 || (templateObject_6 = __makeTemplateObject(["filter eventSource=\"ec2.amazonaws.com\" |\n                           stats count(*) as eventCount by eventName, awsRegion |\n                           sort eventCount desc"], ["filter eventSource=\"ec2.amazonaws.com\" |\n                           stats count(*) as eventCount by eventName, awsRegion |\n                           sort eventCount desc"]))),
            },
            {
                title: 'Regions, usernames, and ARNs of newly created IAM users',
                expr: stripIndents(templateObject_7 || (templateObject_7 = __makeTemplateObject(["filter eventName=\"CreateUser\" |\n                           fields awsRegion, requestParameters.userName, responseElements.user.arn"], ["filter eventName=\"CreateUser\" |\n                           fields awsRegion, requestParameters.userName, responseElements.user.arn"]))),
            },
        ],
    },
    {
        category: 'Common Queries',
        examples: [
            {
                title: '25 most recently added log events',
                expr: stripIndents(templateObject_8 || (templateObject_8 = __makeTemplateObject(["fields @timestamp, @message |\n                           sort @timestamp desc |\n                           limit 25"], ["fields @timestamp, @message |\n                           sort @timestamp desc |\n                           limit 25"]))),
            },
            {
                title: 'Number of exceptions logged every 5 minutes',
                expr: stripIndents(templateObject_9 || (templateObject_9 = __makeTemplateObject(["filter @message like /Exception/ |\n                           stats count(*) as exceptionCount by bin(5m) |\n                           sort exceptionCount desc"], ["filter @message like /Exception/ |\n                           stats count(*) as exceptionCount by bin(5m) |\n                           sort exceptionCount desc"]))),
            },
            {
                title: 'List of log events that are not exceptions',
                expr: 'fields @message | filter @message not like /Exception/',
            },
        ],
    },
    {
        category: 'Route 53',
        examples: [
            {
                title: 'Number of requests received every 10  minutes by edge location',
                expr: 'stats count(*) by queryType, bin(10m)',
            },
            {
                title: 'Number of unsuccessful requests by domain',
                expr: 'filter responseCode="SERVFAIL" | stats count(*) by queryName',
            },
            {
                title: 'Number of requests received every 10  minutes by edge location',
                expr: 'stats count(*) as numRequests by resolverIp | sort numRequests desc | limit 10',
            },
        ],
    },
    {
        category: 'AWS AppSync',
        examples: [
            {
                title: 'Number of unique HTTP status codes',
                expr: stripIndents(templateObject_10 || (templateObject_10 = __makeTemplateObject(["fields ispresent(graphQLAPIId) as isApi |\n                           filter isApi |\n                           filter logType = \"RequestSummary\" |\n                           stats count() as statusCount by statusCode |\n                           sort statusCount desc"], ["fields ispresent(graphQLAPIId) as isApi |\n                           filter isApi |\n                           filter logType = \"RequestSummary\" |\n                           stats count() as statusCount by statusCode |\n                           sort statusCount desc"]))),
            },
            {
                title: 'Top 10 resolvers with maximum latency',
                expr: stripIndents(templateObject_11 || (templateObject_11 = __makeTemplateObject(["fields resolverArn, duration |\n                           filter logType = \"Tracing\" |\n                           sort duration desc |\n                           limit 10"], ["fields resolverArn, duration |\n                           filter logType = \"Tracing\" |\n                           sort duration desc |\n                           limit 10"]))),
            },
            {
                title: 'Most frequently invoked resolvers',
                expr: stripIndents(templateObject_12 || (templateObject_12 = __makeTemplateObject(["fields ispresent(resolverArn) as isRes |\n                           stats count() as invocationCount by resolverArn |\n                           filter isRes |\n                           filter logType = \"Tracing\" |\n                           sort invocationCount desc |\n                           limit 10"], ["fields ispresent(resolverArn) as isRes |\n                           stats count() as invocationCount by resolverArn |\n                           filter isRes |\n                           filter logType = \"Tracing\" |\n                           sort invocationCount desc |\n                           limit 10"]))),
            },
            {
                title: 'Resolvers with most errors in mapping templates',
                expr: stripIndents(templateObject_13 || (templateObject_13 = __makeTemplateObject(["fields ispresent(resolverArn) as isRes |\n                           stats count() as errorCount by resolverArn, logType |\n                           filter isRes and (logType = \"RequestMapping\" or logType = \"ResponseMapping\") and fieldInError |\n                           sort errorCount desc |\n                           limit 10"], ["fields ispresent(resolverArn) as isRes |\n                           stats count() as errorCount by resolverArn, logType |\n                           filter isRes and (logType = \"RequestMapping\" or logType = \"ResponseMapping\") and fieldInError |\n                           sort errorCount desc |\n                           limit 10"]))),
            },
            {
                title: 'Field latency statistics',
                expr: stripIndents(templateObject_14 || (templateObject_14 = __makeTemplateObject(["fields requestId, latency |\n                           filter logType = \"RequestSummary\" |\n                           sort latency desc |\n                           limit 10"], ["fields requestId, latency |\n                           filter logType = \"RequestSummary\" |\n                           sort latency desc |\n                           limit 10"]))),
            },
            {
                title: 'Resolver latency statistics',
                expr: stripIndents(templateObject_15 || (templateObject_15 = __makeTemplateObject(["fields ispresent(resolverArn) as isRes |\n                           filter isRes |\n                           filter logType = \"Tracing\" |\n                           stats min(duration), max(duration), avg(duration) as avgDur by resolverArn |\n                           sort avgDur desc |\n                           limit 10"], ["fields ispresent(resolverArn) as isRes |\n                           filter isRes |\n                           filter logType = \"Tracing\" |\n                           stats min(duration), max(duration), avg(duration) as avgDur by resolverArn |\n                           sort avgDur desc |\n                           limit 10"]))),
            },
            {
                title: 'Top 10 requests with maximum latency',
                expr: stripIndents(templateObject_16 || (templateObject_16 = __makeTemplateObject(["fields requestId, latency |\n                           filter logType = \"RequestSummary\" |\n                           sort latency desc |\n                           limit 10"], ["fields requestId, latency |\n                           filter logType = \"RequestSummary\" |\n                           sort latency desc |\n                           limit 10"]))),
            },
        ],
    },
];
function renderHighlightedMarkup(code, keyPrefix) {
    var grammar = tokenizer;
    var tokens = flattenTokens(Prism.tokenize(code, grammar));
    var spans = tokens
        .filter(function (token) { return typeof token !== 'string'; })
        .map(function (token, i) {
        return (React.createElement("span", { className: "prism-token token " + token.types.join(' ') + " " + token.aliases.join(' '), key: keyPrefix + "-token-" + i }, token.content));
    });
    return React.createElement("div", { className: "slate-query-field" }, spans);
}
var exampleCategory = css(templateObject_17 || (templateObject_17 = __makeTemplateObject(["\n  margin-top: 5px;\n"], ["\n  margin-top: 5px;\n"])));
var LogsCheatSheet = /** @class */ (function (_super) {
    __extends(LogsCheatSheet, _super);
    function LogsCheatSheet() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LogsCheatSheet.prototype.onClickExample = function (query) {
        this.props.onClickExample(query);
    };
    LogsCheatSheet.prototype.renderExpression = function (expr, keyPrefix) {
        var _this = this;
        return (React.createElement("div", { className: "cheat-sheet-item__example", key: expr, onClick: function (e) {
                return _this.onClickExample({ refId: 'A', expression: expr, queryMode: 'Logs', region: 'default', id: 'A' });
            } },
            React.createElement("pre", null, renderHighlightedMarkup(expr, keyPrefix))));
    };
    LogsCheatSheet.prototype.renderLogsCheatSheet = function () {
        var _this = this;
        return (React.createElement("div", null,
            React.createElement("h2", null, "CloudWatch Logs Cheat Sheet"),
            CLIQ_EXAMPLES.map(function (cat, i) { return (React.createElement("div", { key: cat.category + "-" + i },
                React.createElement("div", { className: "cheat-sheet-item__title " + cx(exampleCategory) }, cat.category),
                cat.examples.map(function (item, j) { return (React.createElement("div", { className: "cheat-sheet-item", key: "item-" + j },
                    React.createElement("h4", null, item.title),
                    _this.renderExpression(item.expr, "item-" + j))); }))); })));
    };
    LogsCheatSheet.prototype.render = function () {
        var _this = this;
        return (React.createElement("div", null,
            React.createElement("h3", null, "CloudWatch Logs cheat sheet"),
            CLIQ_EXAMPLES.map(function (cat, i) { return (React.createElement("div", { key: "cat-" + i },
                React.createElement("div", { className: "cheat-sheet-item__title " + cx(exampleCategory) }, cat.category),
                cat.examples.map(function (item, j) { return (React.createElement("div", { className: "cheat-sheet-item", key: "item-" + j },
                    React.createElement("h4", null, item.title),
                    _this.renderExpression(item.expr, "item-" + j))); }))); })));
    };
    return LogsCheatSheet;
}(PureComponent));
export default LogsCheatSheet;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17;
//# sourceMappingURL=LogsCheatSheet.js.map