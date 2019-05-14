import * as tslib_1 from "tslib";
import _ from 'lodash';
var PromCompleter = /** @class */ (function () {
    function PromCompleter(datasource, templateSrv) {
        this.datasource = datasource;
        this.templateSrv = templateSrv;
        this.identifierRegexps = [/\[/, /[a-zA-Z0-9_:]/];
        this.labelQueryCache = {};
        this.labelNameCache = {};
        this.labelValueCache = {};
        this.templateVariableCompletions = this.templateSrv.variables.map(function (variable) {
            return {
                caption: '$' + variable.name,
                value: '$' + variable.name,
                meta: 'variable',
                score: Number.MAX_VALUE,
            };
        });
    }
    PromCompleter.prototype.getCompletions = function (editor, session, pos, prefix, callback) {
        var _this = this;
        var e_1, _a, e_2, _b;
        var wrappedCallback = function (err, completions) {
            completions = completions.concat(_this.templateVariableCompletions);
            return callback(err, completions);
        };
        var token = session.getTokenAt(pos.row, pos.column);
        switch (token.type) {
            case 'entity.name.tag.label-matcher':
                this.getCompletionsForLabelMatcherName(session, pos).then(function (completions) {
                    wrappedCallback(null, completions);
                });
                return;
            case 'string.quoted.label-matcher':
                this.getCompletionsForLabelMatcherValue(session, pos).then(function (completions) {
                    wrappedCallback(null, completions);
                });
                return;
            case 'entity.name.tag.label-list-matcher':
                this.getCompletionsForBinaryOperator(session, pos).then(function (completions) {
                    wrappedCallback(null, completions);
                });
                return;
        }
        if (token.type === 'paren.lparen' && token.value === '[') {
            var vectors = [];
            try {
                for (var _c = tslib_1.__values(['s', 'm', 'h']), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var unit = _d.value;
                    try {
                        for (var _e = tslib_1.__values([1, 5, 10, 30]), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var value = _f.value;
                            vectors.push({
                                caption: value + unit,
                                value: '[' + value + unit,
                                meta: 'range vector',
                            });
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            vectors.unshift({
                caption: '$__interval_ms',
                value: '[$__interval_ms',
                meta: 'range vector',
            });
            vectors.unshift({
                caption: '$__interval',
                value: '[$__interval',
                meta: 'range vector',
            });
            wrappedCallback(null, vectors);
            return;
        }
        var query = prefix;
        return this.datasource.performSuggestQuery(query, true).then(function (metricNames) {
            wrappedCallback(null, metricNames.map(function (name) {
                var value = name;
                if (prefix === '(') {
                    value = '(' + name;
                }
                return {
                    caption: name,
                    value: value,
                    meta: 'metric',
                };
            }));
        });
    };
    PromCompleter.prototype.getCompletionsForLabelMatcherName = function (session, pos) {
        var _this = this;
        var metricName = this.findMetricName(session, pos.row, pos.column);
        if (!metricName) {
            return Promise.resolve(this.transformToCompletions(['__name__', 'instance', 'job'], 'label name'));
        }
        if (this.labelNameCache[metricName]) {
            return Promise.resolve(this.labelNameCache[metricName]);
        }
        return this.getLabelNameAndValueForExpression(metricName, 'metricName').then(function (result) {
            var labelNames = _this.transformToCompletions(_.uniq(_.flatten(result.map(function (r) {
                return Object.keys(r);
            }))), 'label name');
            _this.labelNameCache[metricName] = labelNames;
            return Promise.resolve(labelNames);
        });
    };
    PromCompleter.prototype.getCompletionsForLabelMatcherValue = function (session, pos) {
        var _this = this;
        var metricName = this.findMetricName(session, pos.row, pos.column);
        if (!metricName) {
            return Promise.resolve([]);
        }
        var labelNameToken = this.findToken(session, pos.row, pos.column, 'entity.name.tag.label-matcher', null, 'paren.lparen.label-matcher');
        if (!labelNameToken) {
            return Promise.resolve([]);
        }
        var labelName = labelNameToken.value;
        if (this.labelValueCache[metricName] && this.labelValueCache[metricName][labelName]) {
            return Promise.resolve(this.labelValueCache[metricName][labelName]);
        }
        return this.getLabelNameAndValueForExpression(metricName, 'metricName').then(function (result) {
            var labelValues = _this.transformToCompletions(_.uniq(result.map(function (r) {
                return r[labelName];
            })), 'label value');
            _this.labelValueCache[metricName] = _this.labelValueCache[metricName] || {};
            _this.labelValueCache[metricName][labelName] = labelValues;
            return Promise.resolve(labelValues);
        });
    };
    PromCompleter.prototype.getCompletionsForBinaryOperator = function (session, pos) {
        var _this = this;
        var keywordOperatorToken = this.findToken(session, pos.row, pos.column, 'keyword.control', null, 'identifier');
        if (!keywordOperatorToken) {
            return Promise.resolve([]);
        }
        var rparenToken, expr;
        switch (keywordOperatorToken.value) {
            case 'by':
            case 'without':
                rparenToken = this.findToken(session, keywordOperatorToken.row, keywordOperatorToken.column, 'paren.rparen', null, 'identifier');
                if (!rparenToken) {
                    return Promise.resolve([]);
                }
                expr = this.findExpressionMatchedParen(session, rparenToken.row, rparenToken.column);
                if (expr === '') {
                    return Promise.resolve([]);
                }
                return this.getLabelNameAndValueForExpression(expr, 'expression').then(function (result) {
                    var labelNames = _this.transformToCompletions(_.uniq(_.flatten(result.map(function (r) {
                        return Object.keys(r);
                    }))), 'label name');
                    _this.labelNameCache[expr] = labelNames;
                    return labelNames;
                });
            case 'on':
            case 'ignoring':
            case 'group_left':
            case 'group_right':
                var binaryOperatorToken = this.findToken(session, keywordOperatorToken.row, keywordOperatorToken.column, 'keyword.operator.binary', null, 'identifier');
                if (!binaryOperatorToken) {
                    return Promise.resolve([]);
                }
                rparenToken = this.findToken(session, binaryOperatorToken.row, binaryOperatorToken.column, 'paren.rparen', null, 'identifier');
                if (rparenToken) {
                    expr = this.findExpressionMatchedParen(session, rparenToken.row, rparenToken.column);
                    if (expr === '') {
                        return Promise.resolve([]);
                    }
                    return this.getLabelNameAndValueForExpression(expr, 'expression').then(function (result) {
                        var labelNames = _this.transformToCompletions(_.uniq(_.flatten(result.map(function (r) {
                            return Object.keys(r);
                        }))), 'label name');
                        _this.labelNameCache[expr] = labelNames;
                        return labelNames;
                    });
                }
                else {
                    var metricName_1 = this.findMetricName(session, binaryOperatorToken.row, binaryOperatorToken.column);
                    return this.getLabelNameAndValueForExpression(metricName_1, 'metricName').then(function (result) {
                        var labelNames = _this.transformToCompletions(_.uniq(_.flatten(result.map(function (r) {
                            return Object.keys(r);
                        }))), 'label name');
                        _this.labelNameCache[metricName_1] = labelNames;
                        return Promise.resolve(labelNames);
                    });
                }
        }
        return Promise.resolve([]);
    };
    PromCompleter.prototype.getLabelNameAndValueForExpression = function (expr, type) {
        var _this = this;
        if (this.labelQueryCache[expr]) {
            return Promise.resolve(this.labelQueryCache[expr]);
        }
        var query = expr;
        if (type === 'metricName') {
            var op = '=~';
            if (/[a-zA-Z_:][a-zA-Z0-9_:]*/.test(expr)) {
                op = '=';
            }
            query = '{__name__' + op + '"' + expr + '"}';
        }
        var _a = this.datasource.getTimeRange(), start = _a.start, end = _a.end;
        var url = '/api/v1/series?match[]=' + encodeURIComponent(query) + '&start=' + start + '&end=' + end;
        return this.datasource.metadataRequest(url).then(function (response) {
            _this.labelQueryCache[expr] = response.data.data;
            return response.data.data;
        });
    };
    PromCompleter.prototype.transformToCompletions = function (words, meta) {
        return words.map(function (name) {
            return {
                caption: name,
                value: name,
                meta: meta,
                score: Number.MAX_VALUE,
            };
        });
    };
    PromCompleter.prototype.findMetricName = function (session, row, column) {
        var metricName = '';
        var tokens;
        var nameLabelNameToken = this.findToken(session, row, column, 'entity.name.tag.label-matcher', '__name__', 'paren.lparen.label-matcher');
        if (nameLabelNameToken) {
            tokens = session.getTokens(nameLabelNameToken.row);
            var nameLabelValueToken = tokens[nameLabelNameToken.index + 2];
            if (nameLabelValueToken && nameLabelValueToken.type === 'string.quoted.label-matcher') {
                metricName = nameLabelValueToken.value.slice(1, -1); // cut begin/end quotation
            }
        }
        else {
            var metricNameToken = this.findToken(session, row, column, 'identifier', null, null);
            if (metricNameToken) {
                tokens = session.getTokens(metricNameToken.row);
                metricName = metricNameToken.value;
            }
        }
        return metricName;
    };
    PromCompleter.prototype.findToken = function (session, row, column, target, value, guard) {
        var tokens, idx;
        // find index and get column of previous token
        for (var r = row; r >= 0; r--) {
            var c = void 0;
            tokens = session.getTokens(r);
            if (r === row) {
                // current row
                c = 0;
                for (idx = 0; idx < tokens.length; idx++) {
                    var nc = c + tokens[idx].value.length;
                    if (nc >= column) {
                        break;
                    }
                    c = nc;
                }
            }
            else {
                idx = tokens.length - 1;
                c =
                    _.sum(tokens.map(function (t) {
                        return t.value.length;
                    })) - tokens[tokens.length - 1].value.length;
            }
            for (; idx >= 0; idx--) {
                if (tokens[idx].type === guard) {
                    return null;
                }
                if (tokens[idx].type === target && (!value || tokens[idx].value === value)) {
                    tokens[idx].row = r;
                    tokens[idx].column = c;
                    tokens[idx].index = idx;
                    return tokens[idx];
                }
                c -= tokens[idx].value.length;
            }
        }
        return null;
    };
    PromCompleter.prototype.findExpressionMatchedParen = function (session, row, column) {
        var tokens, idx;
        var deep = 1;
        var expression = ')';
        for (var r = row; r >= 0; r--) {
            tokens = session.getTokens(r);
            if (r === row) {
                // current row
                var c = 0;
                for (idx = 0; idx < tokens.length; idx++) {
                    c += tokens[idx].value.length;
                    if (c >= column) {
                        break;
                    }
                }
            }
            else {
                idx = tokens.length - 1;
            }
            for (; idx >= 0; idx--) {
                expression = tokens[idx].value + expression;
                if (tokens[idx].type === 'paren.rparen') {
                    deep++;
                }
                else if (tokens[idx].type === 'paren.lparen') {
                    deep--;
                    if (deep === 0) {
                        return expression;
                    }
                }
            }
        }
        return expression;
    };
    return PromCompleter;
}());
export { PromCompleter };
//# sourceMappingURL=completer.js.map