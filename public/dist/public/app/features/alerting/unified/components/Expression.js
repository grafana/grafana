import { __assign, __makeTemplateObject } from "tslib";
import { Editor } from '@grafana/slate-react';
import React, { useMemo } from 'react';
import PromqlSyntax from 'app/plugins/datasource/prometheus/promql';
import LogqlSyntax from 'app/plugins/datasource/loki/syntax';
import { languages as prismLanguages } from 'prismjs';
import { makeValue, SlatePrism, useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { DataSourceType, isCloudRulesSource } from '../utils/datasource';
import { Well } from './Well';
export var HighlightedQuery = function (_a) {
    var language = _a.language, expr = _a.expr;
    var plugins = useMemo(function () {
        var _a;
        return [
            SlatePrism({
                onlyIn: function (node) { return node.type === 'code_block'; },
                getSyntax: function () { return language; },
            }, __assign(__assign({}, prismLanguages), (_a = {}, _a[language] = language === 'logql' ? LogqlSyntax : PromqlSyntax, _a))),
        ];
    }, [language]);
    var slateValue = useMemo(function () { return makeValue(expr); }, [expr]);
    return React.createElement(Editor, { plugins: plugins, value: slateValue, readOnly: true });
};
export var Expression = function (_a) {
    var query = _a.expression, rulesSource = _a.rulesSource;
    var styles = useStyles(getStyles);
    return (React.createElement(Well, { className: cx(styles.well, 'slate-query-field') }, isCloudRulesSource(rulesSource) ? (React.createElement(HighlightedQuery, { expr: query, language: rulesSource.type === DataSourceType.Loki ? 'logql' : 'promql' })) : (query)));
};
export var getStyles = function (theme) { return ({
    well: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    font-family: ", ";\n  "], ["\n    font-family: ", ";\n  "])), theme.typography.fontFamily.monospace),
}); };
var templateObject_1;
//# sourceMappingURL=Expression.js.map