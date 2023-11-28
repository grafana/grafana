import { css, cx } from '@emotion/css';
import { languages as prismLanguages } from 'prismjs';
import React, { useMemo } from 'react';
import { Editor } from 'slate-react';
import { makeValue, SlatePrism, useStyles2 } from '@grafana/ui';
import LogqlSyntax from 'app/plugins/datasource/loki/syntax';
import PromqlSyntax from 'app/plugins/datasource/prometheus/promql';
import { DataSourceType, isCloudRulesSource } from '../utils/datasource';
import { Well } from './Well';
export const HighlightedQuery = ({ language, expr }) => {
    const plugins = useMemo(() => [
        SlatePrism({
            onlyIn: (node) => 'type' in node && node.type === 'code_block',
            getSyntax: () => language,
        }, Object.assign(Object.assign({}, prismLanguages), { [language]: language === 'logql' ? LogqlSyntax : PromqlSyntax })),
    ], [language]);
    const slateValue = useMemo(() => makeValue(expr), [expr]);
    //We don't want to set readOnly={true} to the Editor to prevent unwanted charaters in the copied text. See https://github.com/grafana/grafana/pull/57839
    return React.createElement(Editor, { "data-testid": 'expression-editor', plugins: plugins, value: slateValue });
};
export const Expression = ({ expression: query, rulesSource }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Well, { className: cx(styles.well, 'slate-query-field') }, isCloudRulesSource(rulesSource) ? (React.createElement(HighlightedQuery, { expr: query, language: rulesSource.type === DataSourceType.Loki ? 'logql' : 'promql' })) : (query)));
};
export const getStyles = (theme) => ({
    well: css `
    font-family: ${theme.typography.fontFamilyMonospace};
  `,
});
//# sourceMappingURL=Expression.js.map