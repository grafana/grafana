import { Editor } from '@grafana/slate-react';
import React, { FC, useMemo } from 'react';
import PromqlSyntax from 'app/plugins/datasource/prometheus/promql';
import LogqlSyntax from 'app/plugins/datasource/loki/syntax';
import { LanguageMap, languages as prismLanguages } from 'prismjs';
import { makeValue, SlatePrism, useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { RulesSource } from 'app/types/unified-alerting';
import { DataSourceType, isCloudRulesSource } from '../utils/datasource';
import { Well } from './Well';

interface Props {
  expression: string;
  rulesSource: RulesSource;
}

export const HighlightedQuery: FC<{ language: 'promql' | 'logql'; expr: string }> = ({ language, expr }) => {
  const plugins = useMemo(
    () => [
      SlatePrism(
        {
          onlyIn: (node: any) => node.type === 'code_block',
          getSyntax: () => language,
        },
        { ...(prismLanguages as LanguageMap), [language]: language === 'logql' ? LogqlSyntax : PromqlSyntax }
      ),
    ],
    [language]
  );

  const slateValue = useMemo(() => makeValue(expr), [expr]);

  return <Editor plugins={plugins} value={slateValue} readOnly={true} />;
};

export const Expression: FC<Props> = ({ expression: query, rulesSource }) => {
  const styles = useStyles(getStyles);

  return (
    <Well className={cx(styles.well, 'slate-query-field')}>
      {isCloudRulesSource(rulesSource) ? (
        <HighlightedQuery expr={query} language={rulesSource.type === DataSourceType.Loki ? 'logql' : 'promql'} />
      ) : (
        query
      )}
    </Well>
  );
};

export const getStyles = (theme: GrafanaTheme) => ({
  well: css`
    font-family: ${theme.typography.fontFamily.monospace};
  `,
});
